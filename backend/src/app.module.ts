import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsModule } from './jobs/jobs.module';
import { Job } from './jobs/entities/job.entity';

// Defaults to a local SQLite file so the assignment runs with zero external
// setup. If a DATABASE_URL is provided (e.g. when deploying to a host that
// gives you a managed Postgres instance), we switch to Postgres instead -
// same entities/queries work unchanged since we only use portable TypeORM
// query-builder SQL.
const databaseUrl = process.env.DATABASE_URL;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    databaseUrl
      ? TypeOrmModule.forRoot({
          type: 'postgres',
          url: databaseUrl,
          entities: [Job],
          synchronize: true,
          ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
        })
      : TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: process.env.DB_PATH || 'job-queue.sqlite',
          entities: [Job],
          synchronize: true,
        }),
    JobsModule,
  ],
})
export class AppModule {}
