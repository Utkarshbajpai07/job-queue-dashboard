import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from './entities/job.entity';
import { CreateJobDto } from './dto/create-job.dto';

// Only these transitions are legal:
//   pending -> running
//   running -> completed
//   running -> failed
// completed/failed are terminal. Keyed by the status being moved *into*,
// value is the set of statuses it is legal to move *from*.
const ALLOWED_PREVIOUS_STATUS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.PENDING]: [], // nothing can transition back into "pending"
  [JobStatus.RUNNING]: [JobStatus.PENDING],
  [JobStatus.COMPLETED]: [JobStatus.RUNNING],
  [JobStatus.FAILED]: [JobStatus.RUNNING],
};

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobsRepository: Repository<Job>,
  ) {}

  create(dto: CreateJobDto): Promise<Job> {
    const job = this.jobsRepository.create({
      title: dto.title,
      type: dto.type,
      status: JobStatus.PENDING,
    });
    return this.jobsRepository.save(job);
  }

  findAll(): Promise<Job[]> {
    return this.jobsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async remove(id: string): Promise<void> {
    const result = await this.jobsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Job ${id} not found`);
    }
  }

  /**
   * Updates a job's status while enforcing the allowed state machine AND
   * protecting against concurrent requests racing to move the same job.
   *
   * Why this approach:
   * Two browser tabs (or two direct API callers) can both read the job as
   * "pending" and both fire PATCH .../status { status: "running" } at
   * nearly the same instant. If we did "read job -> check in app code ->
   * write job" as three separate steps, both requests could pass the
   * in-app check before either write lands (classic check-then-act race),
   * and the job would be "started twice".
   *
   * Instead we push the check into the UPDATE statement itself:
   *
   *   UPDATE jobs SET status = 'running'
   *   WHERE id = :id AND status = 'pending'
   *
   * A single UPDATE statement is atomic as far as any relational database
   * is concerned (SQLite serializes writers; Postgres takes a row lock for
   * the duration of the statement). Whichever request's UPDATE reaches the
   * database first will match the WHERE clause and win, flipping the row
   * to "running". The second request's UPDATE runs against a row that no
   * longer has status = 'pending', so it matches zero rows. We can then
   * tell the loser that the job's state has already moved on, rather than
   * silently double-applying the transition or corrupting state.
   *
   * This gives us correctness without needing an explicit row lock,
   * SELECT ... FOR UPDATE, or a distributed lock/queue for this scale of
   * problem.
   */
  async updateStatus(id: string, nextStatus: JobStatus): Promise<Job> {
    const allowedFrom = ALLOWED_PREVIOUS_STATUS[nextStatus];

    if (!allowedFrom || allowedFrom.length === 0) {
      // Either an unknown status (already blocked by DTO validation) or a
      // status nothing may transition into directly (e.g. back to pending).
      throw new ConflictException(
        `Jobs cannot transition into status "${nextStatus}"`,
      );
    }

    const result = await this.jobsRepository
      .createQueryBuilder()
      .update(Job)
      .set({ status: nextStatus })
      .where('id = :id', { id })
      .andWhere('status IN (:...allowedFrom)', { allowedFrom })
      .execute();

    if (result.affected && result.affected > 0) {
      const updated = await this.jobsRepository.findOneBy({ id });
      if (!updated) {
        throw new NotFoundException(`Job ${id} not found`);
      }
      return updated;
    }

    // Nothing was updated - figure out why, for a useful error message.
    const existing = await this.jobsRepository.findOneBy({ id });

    if (!existing) {
      throw new NotFoundException(`Job ${id} not found`);
    }

    // The job exists but wasn't in an eligible status when our UPDATE ran.
    // This is either: (a) an invalid transition attempted directly against
    // the API (e.g. completed -> running), or (b) a legitimate transition
    // that lost a race to a concurrent request (e.g. another tab already
    // moved pending -> running a moment earlier).
    throw new ConflictException(
      `Cannot transition job from "${existing.status}" to "${nextStatus}". ` +
        `Allowed source status(es) for "${nextStatus}": ${allowedFrom.join(', ')}. ` +
        `The job's current status is "${existing.status}" - it may have just been ` +
        `changed by another request.`,
    );
  }
}
