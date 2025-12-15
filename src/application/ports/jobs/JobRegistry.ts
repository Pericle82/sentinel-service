export type JobName = string;

export type Job = {
  name: JobName;
  description?: string;
  run(): Promise<void>;
};

export interface JobRegistry {
  list(): Promise<JobName[]>;
  run(name: JobName): Promise<void>;
}
