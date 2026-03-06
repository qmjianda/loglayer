import React, { RefObject } from 'react';

interface FileInputsProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFolderUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FileInputs: React.FC<FileInputsProps> = ({
  fileInputRef,
  folderInputRef,
  onFileUpload,
  onFolderUpload
}) => {
  const dirInputProps = {
    webkitdirectory: '',
    directory: '',
  } as React.InputHTMLAttributes<HTMLInputElement>;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={onFileUpload}
        accept=".log,.txt,.json,*"
      />
      <input
        ref={folderInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={onFolderUpload}
        {...dirInputProps}
        multiple
      />
    </>
  );
};