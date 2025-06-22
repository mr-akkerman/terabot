'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X, AlertTriangle } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useFormContext, Controller } from 'react-hook-form';

import { LoadingSpinner } from '../ui/LoadingSpinner';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface ImageUploaderProps {
  value?: string;
  onChange: (base64?: string) => void;
}

export function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const { control, setValue, watch } = useFormContext();
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: any[]) => {
    setError(null);
    if (fileRejections.length > 0) {
      setError(fileRejections[0].errors[0].message);
      return;
    }
    
    const file = acceptedFiles[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 2, // Aim for a smaller size
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      });

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        setPreview(base64);
        onChange(base64);
      };
      reader.readAsDataURL(compressedFile);

    } catch (err) {
      setError('Failed to process image. Please try another one.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/gif': [] },
    maxSize: MAX_SIZE_BYTES,
    multiple: false,
  });

  const removeImage = () => {
    setPreview(null);
    onChange(undefined);
  };

  useEffect(() => {
    setPreview(value || null);
  }, [value]);

  return (
    <Controller
      name="image"
      control={control}
      render={({ fieldState }) => (
        <div className="space-y-2">
            {preview ? (
                <div className="relative group w-full aspect-video rounded-md overflow-hidden">
                    <img src={preview} alt="Preview" className="w-full h-full object-contain bg-secondary/50" />
                    <div className="absolute top-2 right-2">
                        <button
                            type="button"
                            onClick={removeImage}
                            className="p-1.5 bg-background/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    {...getRootProps()}
                    className={`relative w-full aspect-video rounded-md border-2 border-dashed flex flex-col justify-center items-center text-center p-4 cursor-pointer transition-colors
                    ${isDragActive ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}
                    ${fieldState.error ? 'border-destructive' : ''}
                    `}
                >
                    <input {...getInputProps()} />
                    {isLoading ? (
                        <LoadingSpinner size={32} />
                    ) : (
                        <div className="text-muted-foreground">
                            <UploadCloud className="mx-auto h-12 w-12" />
                            <p className="mt-2">Drag & drop an image here, or click to select</p>
                            <p className="text-xs">PNG, JPG, GIF up to {MAX_SIZE_MB}MB</p>
                        </div>
                    )}
                </div>
            )}
            {(error || fieldState.error) && (
                 <div className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{error || fieldState.error?.message}</span>
                </div>
            )}
        </div>
      )}
    />
  );
} 