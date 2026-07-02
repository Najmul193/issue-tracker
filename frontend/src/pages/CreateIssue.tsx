import { useState, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createIssue, uploadAttachments } from '../api/issues';
import type { IssueType, IssuePriority } from '../api/issues';
import { ApiError } from '../api/client';
import { addDays } from 'date-fns';

const typeOptions: { label: string; value: IssueType }[] = [
  { label: 'Bug', value: 'BUG' },
  { label: 'New Requirement', value: 'NEW_REQUIREMENT' },
  { label: 'Change Request', value: 'CHANGE_REQUEST' },
  { label: 'Query', value: 'QUERY' },
];

const priorityOptions: { label: string; value: IssuePriority }[] = [
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
];

const priorityDeadlineDays: Record<IssuePriority, number> = {
  CRITICAL: 1,
  HIGH: 2,
  MEDIUM: 5,
  LOW: 14,
};

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_FILES = 5;

interface SelectedFile {
  file: File;
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toDatetimeLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

export default function CreateIssue() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<IssueType>('BUG');
  const [priority, setPriority] = useState<IssuePriority>('MEDIUM');
  const [module, setModule] = useState('');
  const [deadline, setDeadline] = useState(() =>
    toDatetimeLocal(addDays(new Date(), 5)),
  );
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [deadlineManuallyEdited, setDeadlineManuallyEdited] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const issue = await createIssue({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        deadline: new Date(deadline).toISOString(),
        module: module.trim() || undefined,
      });

      if (selectedFiles.length > 0) {
        const validFiles = selectedFiles
          .filter((f) => !f.error)
          .map((f) => f.file);
        if (validFiles.length > 0) {
          await uploadAttachments(issue.id, validFiles, (pct) =>
            setUploadProgress(pct),
          );
        }
      }

      return issue;
    },
    onSuccess: (issue) => {
      navigate(`/issues/${issue.id}`, { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
    },
  });

  function handlePriorityChange(newPriority: IssuePriority) {
    setPriority(newPriority);
    if (!deadlineManuallyEdited) {
      setDeadline(toDatetimeLocal(addDays(new Date(), priorityDeadlineDays[newPriority])));
    }
  }

  function handleDeadlineChange(value: string) {
    setDeadline(value);
    setDeadlineManuallyEdited(true);
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!title.trim()) errors.title = 'Title is required';
    if (!deadline) {
      errors.deadline = 'Deadline is required';
    } else if (new Date(deadline) <= new Date()) {
      errors.deadline = 'Deadline must be in the future';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;
    createMutation.mutate();
  }

  function handleFileSelect(files: FileList | null) {
    if (!files) return;
    const newFiles: SelectedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let error: string | undefined;

      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        error = `File type "${file.type || 'unknown'}" is not allowed`;
      } else if (file.size > MAX_FILE_SIZE) {
        error = `File exceeds 15MB limit (${formatFileSize(file.size)})`;
      }

      newFiles.push({ file, error });
    }

    const combined = [...selectedFiles, ...newFiles].slice(0, MAX_FILES);
    if (combined.length < selectedFiles.length + newFiles.length) {
      setApiError(`Maximum ${MAX_FILES} files allowed`);
    }
    setSelectedFiles(combined);
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const isSubmitting = createMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-6 text-xl font-semibold text-gray-900">Create Issue</h2>

      {apiError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (fieldErrors.title) setFieldErrors((p) => ({ ...p, title: '' }));
            }}
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              fieldErrors.title ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {fieldErrors.title && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Type + Priority row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value as IssueType)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
              Priority <span className="text-red-500">*</span>
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => handlePriorityChange(e.target.value as IssuePriority)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {priorityOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Module + Deadline row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="module" className="block text-sm font-medium text-gray-700">
              Module
            </label>
            <input
              id="module"
              type="text"
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder="e.g. Authentication"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">
              Deadline <span className="text-red-500">*</span>
            </label>
            <input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => handleDeadlineChange(e.target.value)}
              className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                fieldErrors.deadline ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {fieldErrors.deadline && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.deadline}</p>
            )}
          </div>
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Attachments (optional)
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileSelect(e.dataTransfer.files);
            }}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-500 hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-xs">Drag & drop files here, or click to browse</p>
            <p className="mt-1 text-xs text-gray-400">
              Max {MAX_FILES} files, 15MB each. Allowed: images, PDF, Word, Excel, text, archives
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />

          {selectedFiles.length > 0 && (
            <ul className="mt-3 space-y-2">
              {selectedFiles.map((sf, idx) => (
                <li
                  key={idx}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    sf.error ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium text-gray-700">
                      {sf.file.name}
                    </span>
                    <span className="shrink-0 text-gray-400">
                      {formatFileSize(sf.file.size)}
                    </span>
                    {sf.error && (
                      <span className="shrink-0 text-xs text-red-600">{sf.error}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="shrink-0 ml-2 text-gray-400 hover:text-red-500"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {uploadProgress !== null && (
            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Uploading... {uploadProgress}%</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Issue'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/issues')}
            className="rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}