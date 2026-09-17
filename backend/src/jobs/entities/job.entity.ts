import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  type: string;

  @Column({
    type: 'varchar',
    default: JobStatus.PENDING,
  })
  status: JobStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
