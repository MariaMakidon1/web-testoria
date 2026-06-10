import apiClient from "./client";
import type {
  Attachment,
  BulkUploadResponse,
  TestResult,
  TestResultCreate,
  TestResultHistory,
  TestResultUpdate,
} from "@/types/testResult";

export async function getTestResults(runId: number): Promise<TestResult[]> {
  const response = await apiClient.get<TestResult[]>(
    `/test-runs/${runId}/results`,
  );
  return response.data;
}

export async function getTestResult(id: number): Promise<TestResult> {
  const response = await apiClient.get<TestResult>(`/test-results/${id}`);
  return response.data;
}

export async function submitTestResult(
  runId: number,
  data: TestResultCreate,
): Promise<TestResult> {
  const response = await apiClient.post<TestResult>(
    `/test-runs/${runId}/results`,
    data,
  );
  return response.data;
}

export async function updateTestResult(
  id: number,
  data: TestResultUpdate,
): Promise<TestResult> {
  const response = await apiClient.put<TestResult>(`/test-results/${id}`, data);
  return response.data;
}

export async function getTestResultHistory(
  resultId: number,
): Promise<TestResultHistory[]> {
  const response = await apiClient.get<TestResultHistory[]>(
    `/test-results/${resultId}/history`,
  );
  return response.data;
}

export async function uploadAttachment(
  resultId: number,
  file: File,
): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<Attachment>(
    `/test-results/${resultId}/attachments`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data;
}

export async function uploadAttachmentsBulk(
  resultId: number,
  files: File[],
): Promise<BulkUploadResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file, file.name);
  }
  const response = await apiClient.post<BulkUploadResponse>(
    `/test-results/${resultId}/attachments/bulk`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data;
}

export async function deleteAttachment(
  resultId: number,
  attachmentId: number,
): Promise<void> {
  await apiClient.delete(
    `/test-results/${resultId}/attachments/${attachmentId}`,
  );
}
