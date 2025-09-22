export interface DatasetEntity {
  id: string;
  filename: string;
  originalName: string;
  uploadedAt: string;
  rows: number;
  secondsStart: string | null;
  secondsEnd: string | null;
  note: string | null;
  isActive: boolean;
}

export interface CreateDatasetInput {
  id: string;
  filename: string;
  originalName: string;
  uploadedAt: string;
  rows: number;
  secondsStart: string | null;
  secondsEnd: string | null;
  note: string | null;
  isActive?: boolean;
}
