import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// The job "type" field is a free-ish classifier (e.g. "email", "report", "video-encode").
// We keep it as a validated string rather than a hardcoded enum since new job types
// are expected to be added by producers without a backend deploy. Title/type are
// still constrained (non-empty, max length) to avoid garbage data.
export class CreateJobDto {
  @IsString()
  @IsNotEmpty({ message: 'title is required' })
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'type is required' })
  @MaxLength(100)
  type: string;
}
