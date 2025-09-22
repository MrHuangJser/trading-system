import type { DatasetSummary } from '../types';
import { API_BASE } from './backtest';

const DATASETS_ENDPOINT = `${API_BASE}/api/data`;

function encodeDatasetId(id: string): string {
  return encodeURIComponent(id);
}

async function buildRequestError(response: Response, fallback: string): Promise<Error> {
  let message = `${fallback} (${response.status})`;
  try {
    const text = await response.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: unknown };
        const parsedMessage = parsed?.message;
        if (typeof parsedMessage === 'string') {
          message = parsedMessage;
        } else if (Array.isArray(parsedMessage)) {
          message = parsedMessage.join(', ');
        } else {
          message = text;
        }
      } catch {
        message = text;
      }
    }
  } catch {
    // Ignore body parsing errors and keep fallback message.
  }
  return new Error(message);
}

export async function listDatasets(): Promise<DatasetSummary[]> {
  const response = await fetch(DATASETS_ENDPOINT);
  if (!response.ok) {
    throw await buildRequestError(response, '无法获取数据集');
  }
  return (await response.json()) as DatasetSummary[];
}

export interface UploadDatasetOptions {
  note?: string;
  activate?: boolean;
}

export async function uploadDataset(
  file: File,
  options?: UploadDatasetOptions,
): Promise<DatasetSummary> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.note) {
    formData.append('note', options.note);
  }
  if (options?.activate) {
    formData.append('activate', 'true');
  }

  const response = await fetch(`${DATASETS_ENDPOINT}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw await buildRequestError(response, '上传数据集失败');
  }

  return (await response.json()) as DatasetSummary;
}

export async function activateDataset(datasetId: string): Promise<DatasetSummary> {
  const response = await fetch(
    `${DATASETS_ENDPOINT}/${encodeDatasetId(datasetId)}/activate`,
    {
      method: 'PATCH',
    },
  );

  if (!response.ok) {
    throw await buildRequestError(response, '激活数据集失败');
  }

  return (await response.json()) as DatasetSummary;
}

export async function deleteDataset(datasetId: string): Promise<void> {
  const response = await fetch(`${DATASETS_ENDPOINT}/${encodeDatasetId(datasetId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw await buildRequestError(response, '删除数据集失败');
  }
}
