import { useState, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadCloud, FileText, Trash2, X } from 'lucide-react';
import { createIssue, uploadAttachments, deleteIssue } from '../api/issues';
import type { IssueType, IssuePriority } from '../api/issues';
import { useProjectFilter } from '../context/ProjectFilterContext';
import { ApiError } from '../api/client';
import { addDays } from 'date-fns';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import AlertBanner from '../components/ui/AlertBanner';

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
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
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
  const [deadline, setDeadline] = useState(() => toDatetimeLocal(addDays(new Date(), 5)));
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [deadlineManuallyEdited, setDeadlineManuallyEdited] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { allProjects, selectedProjectIds, isAllSelected } = useProjectFilter();

  // Determine which projects to show in the dropdown
  const visibleProjects = isAllSelected
    ? allProjects
    : allProjects.filter((p) => selectedProjectIds.includes(p.id));

  // Auto-set project if only 1 is visible, otherwise require selection
  const autoProjectId = visibleProjects.length === 1 ? visibleProjects[0].id : '';
  const showProjectDropdown = visibleProjects.length > 1;
  const [projectId, setProjectId] = useState(autoProjectId);

  const createMutation = useMutation({
    mutationFn: async () => {
      const issue = await createIssue({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        priority,
        deadline: new Date(deadline).toISOString(),
        module: module.trim() || undefined,
        projectId,
      });

      if (selectedFiles.length > 0) {
        const validFiles = selectedFiles.filter((f) => !f.error).map((f) => f.file);
        if (validFiles.length > 0) {
          try {
            await uploadAttachments(issue.id, validFiles, (pct) => setUploadProgress(pct));
          } catch (err) {
            await deleteIssue(issue.id).catch(() => {});
            throw err;
          }
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
    if (!projectId) errors.projectId = 'Project is required';
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
      <h2 className="mb-6 text-xl font-semibold text-neutral-900 dark:text-slate-100">Create Issue</h2>

      <AnimatePresence>{apiError && <AlertBanner tone="error">{apiError}</AlertBanner>}</AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Project */}
        {visibleProjects.length === 0 ? (
          <AlertBanner tone="warning">
            <p className="font-medium">No projects selected</p>
            <p className="mt-0.5 text-xs">
              Select at least one project from the filter in the top navigation bar before creating an issue.
            </p>
          </AlertBanner>
        ) : showProjectDropdown ? (
          <Select
            id="project"
            label="Project *"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              if (fieldErrors.projectId) setFieldErrors((p) => ({ ...p, projectId: '' }));
            }}
            error={fieldErrors.projectId}
          >
            <option value="">Select a project...</option>
            {visibleProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        ) : visibleProjects.length === 1 ? (
          <div className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:bg-slate-700/50 dark:text-slate-300">
            <span className="font-medium text-neutral-700 dark:text-slate-200">Project:</span> {visibleProjects[0].name}
          </div>
        ) : null}

        <Input
          id="title"
          label="Title *"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (fieldErrors.title) setFieldErrors((p) => ({ ...p, title: '' }));
          }}
          error={fieldErrors.title}
        />

        <Textarea
          id="description"
          label="Description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Type + Priority row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select id="type" label="Type *" value={type} onChange={(e) => setType(e.target.value as IssueType)}>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            id="priority"
            label="Priority *"
            value={priority}
            onChange={(e) => handlePriorityChange(e.target.value as IssuePriority)}
          >
            {priorityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Module + Deadline row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="module"
            label="Module"
            value={module}
            onChange={(e) => setModule(e.target.value)}
            placeholder="e.g. Authentication"
          />
          <Input
            id="deadline"
            type="datetime-local"
            label="Deadline *"
            value={deadline}
            onChange={(e) => handleDeadlineChange(e.target.value)}
            error={fieldErrors.deadline}
          />
        </div>

        {/* Attachments */}
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-slate-300">
            Attachments (optional)
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileSelect(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-sm transition-colors ${
              isDragging
                ? 'border-brand-400 bg-brand-50 dark:border-brand-500/60 dark:bg-brand-500/10'
                : 'border-neutral-300 bg-neutral-50 text-neutral-500 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10'
            }`}
          >
            <UploadCloud className="mb-2 h-8 w-8 text-neutral-400 dark:text-slate-500" />
            <p className="text-xs">Drag &amp; drop files here, or click to browse</p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-slate-500">
              Max {MAX_FILES} files, 15MB each. Allowed: images, PDF, Word, Excel, text, archives
            </p>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />

          <AnimatePresence initial={false}>
            {selectedFiles.length > 0 && (
              <ul className="mt-3 space-y-2">
                {selectedFiles.map((sf, idx) => (
                  <motion.li
                    key={`${sf.file.name}-${idx}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                      sf.error
                        ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
                        : 'border-neutral-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-neutral-400 dark:text-slate-500" />
                      <span className="truncate font-medium text-neutral-700 dark:text-slate-200">{sf.file.name}</span>
                      <span className="shrink-0 text-neutral-400 dark:text-slate-500">{formatFileSize(sf.file.size)}</span>
                      {sf.error && <span className="shrink-0 text-xs text-red-600 dark:text-red-400">{sf.error}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="ml-2 shrink-0 text-neutral-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.li>
                ))}
              </ul>
            )}
          </AnimatePresence>

          {uploadProgress !== null && (
            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-slate-700">
                <motion.div
                  className="h-2 rounded-full bg-brand-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">Uploading... {uploadProgress}%</p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
          <Button type="submit" isLoading={isSubmitting} size="md" className="px-6">
            {isSubmitting ? 'Creating...' : 'Create Issue'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/issues')} icon={<X />} className="px-6">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
