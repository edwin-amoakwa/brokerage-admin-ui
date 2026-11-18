import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from './api-response';

/**
 * Thin HTTP client over the admin API. Paths are relative to
 * environment.baseApi (for example 'users', 'stocks/12'). Every call resolves
 * to the ApiResponse envelope; on HTTP errors it resolves to the error body
 * (with success=false) instead of throwing, so screens can simply check
 * `response.success`. The interceptor already shows the toast.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  url(path: string): string {
    return `${environment.baseApi}/${path.replace(/^\//, '')}`;
  }

  get(path: string, params?: any): Promise<ApiResponse> {
    return this.run(this.http.get<ApiResponse>(this.url(path), { params: toParams(params) }));
  }

  post(path: string, body?: any, params?: any): Promise<ApiResponse> {
    return this.run(this.http.post<ApiResponse>(this.url(path), body ?? {}, { params: toParams(params) }));
  }

  put(path: string, body?: any, params?: any): Promise<ApiResponse> {
    return this.run(this.http.put<ApiResponse>(this.url(path), body ?? {}, { params: toParams(params) }));
  }

  delete(path: string, params?: any): Promise<ApiResponse> {
    return this.run(this.http.delete<ApiResponse>(this.url(path), { params: toParams(params) }));
  }

  /** A POST that shows no toast at all, success or error (background calls). */
  postQuiet(path: string, body?: any): Promise<ApiResponse> {
    return this.run(this.http.post<ApiResponse>(this.url(path), body ?? {}, { headers: { 'X-Quiet': '1' } }));
  }

  /** Like save()/delete(), without the success toast (for follow-up writes after a main save). */
  saveSilent(path: string, record: any): Promise<ApiResponse> {
    const headers = { 'X-Silent': '1' };
    return record?.id
      ? this.run(this.http.put<ApiResponse>(this.url(path), record ?? {}, { headers }))
      : this.run(this.http.post<ApiResponse>(this.url(path), record ?? {}, { headers }));
  }

  deleteSilent(path: string): Promise<ApiResponse> {
    return this.run(this.http.delete<ApiResponse>(this.url(path), { headers: { 'X-Silent': '1' } }));
  }

  /** POST when the record has no id, PUT otherwise (astra's saveXxx convention). */
  save(path: string, record: any): Promise<ApiResponse> {
    return record?.id ? this.put(path, record) : this.post(path, record);
  }

  private async run(request: any): Promise<ApiResponse> {
    try {
      return await lastValueFrom(request);
    } catch (error: any) {
      const body = error?.error;
      if (body && typeof body === 'object' && 'success' in body) {
        return body as ApiResponse;
      }
      return { success: false, statusCode: error?.status ?? 0, message: error?.message ?? 'Request failed', data: null };
    }
  }
}

/** Drops null, undefined and empty values so they are not sent as "null". */
export function toParams(params?: any): HttpParams {
  let result = new HttpParams();
  if (!params) {
    return result;
  }
  for (const key of Object.keys(params)) {
    const value = params[key];
    if (value === null || value === undefined || value === '') {
      continue;
    }
    result = result.set(key, value instanceof Date ? isoDate(value)! : String(value));
  }
  return result;
}

/** yyyy-MM-dd in local time, the format the backend's LocalDate params expect. */
export function isoDate(date: Date | string | null | undefined): string | null {
  if (!date) {
    return null;
  }
  if (typeof date === 'string') {
    return date.substring(0, 10);
  }
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function today(): string {
  return isoDate(new Date())!;
}

/** Reads a browser File as a data URL, the shape FileUploadDto.fileString expects. */
export function readFileAsUpload(file: File): Promise<{ fileString: string; fileName: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ fileString: String(reader.result), fileName: file.name, mimeType: file.type });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
