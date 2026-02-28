import { useCallback, useEffect, useState } from "react";
import Progress from "./Progress";
import { useDropzone } from "react-dropzone";
import Compressor from "compressorjs";
import {
  CloudUpload,
  X,
  FileText,
  Film,
  Music,
  FileSpreadsheet,
} from "lucide-react";

import S3 from "aws-sdk/clients/s3.js";
import { cn } from "@/lib/utils";

const s3 = new S3({
  endpoint: process.env.NEXT_PUBLIC_S3_ENDPOINT,
  accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY,
  secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_KEY,
  signatureVersion: "v4",
});

const S3_BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET;

function ImageUpload({
  randomName,
  images: oldImgs,
  setUploadModal,
  setUploadedImage,
  imageOnly = false,
  uploadDone,
  oneSelect,
  autoUpload,
}) {
  const [images, setImages] = useState([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);

  const types = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "audio/wav",
    "audio/mpeg",
    "audio/mp3",
    "text/csv",
    "application/vnd.ms-excel", // .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  ];

  const generateRandomName = (file) => {
    const originalName = file.name;
    const extension = originalName.split(".").pop();
    const fileNameWithoutExtension = originalName.replace(`.${extension}`, ""); // Remove the file extension
    const randomString = Math.random().toString(36).substring(7);
    return randomName
      ? `RND_${randomString}.${extension}`
      : `${fileNameWithoutExtension}_KMG${randomString}.${extension}`;
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      new Compressor(file, {
        quality: 0.7, // Set the quality (0.0 to 1.0) for image compression
        maxWidth: 1920, // Set the maximum width of the compressed image
        success: (compressedFile) => resolve(compressedFile),
        error: (error) => reject(error),
      });
    });
  };

  const handleUpload = async () => {
    if (
      !S3_BUCKET ||
      !process.env.NEXT_PUBLIC_S3_ENDPOINT ||
      !process.env.NEXT_PUBLIC_S3_ACCESS_KEY ||
      !process.env.NEXT_PUBLIC_S3_SECRET_KEY
    ) {
      alert(
        "S3 configuration is missing. Please check your .env file and ensure NEXT_PUBLIC_S3_BUCKET, NEXT_PUBLIC_S3_ENDPOINT, NEXT_PUBLIC_S3_ACCESS_KEY, and NEXT_PUBLIC_S3_SECRET_KEY are set."
      );
      console.error("Missing S3 configuration");
      return;
    }

    if (images.length) {
      try {
        let uploadedKeys = [];

        for (let file of files) {
          setProgress(5);
          let uploadFileType = file.type;

          // Check if the file is an image, video, or PDF
          if (file.type.startsWith("image")) {
            const compressedFile = await compressImage(file);
            file = compressedFile;
          }

          const fileName = generateRandomName(file);
          const params = {
            Bucket: S3_BUCKET,
            Key: fileName,
            Body: file,
            ACL: "public-read",
            ContentType: uploadFileType,
          };
          const managedUpload = s3.upload(params);

          managedUpload.on("httpUploadProgress", (progress) => {
            const { loaded, total } = progress;
            const percentage = Math.round((loaded / total) * 100);
            setProgress(percentage);
          });

          const uploadResult = await managedUpload.promise();
          console.log(
            "🚀 ~ file: index.js:77 ~ handleUpload ~ uploadResult:",
            uploadResult
          );
          uploadedKeys.push(
            uploadResult?.Location ||
              uploadResult?.location ||
              uploadResult?.Key ||
              uploadResult?.key
          );
        }
        const old = oldImgs || [];
        setUploadedImage([...old, ...uploadedKeys]);
        setProgress(0);
        setImages([]);
        setUploadModal && setUploadModal(false);
        uploadDone && uploadDone();
      } catch (error) {
        console.error("Error uploading :", error);
        setError("Something went wrong!");
      }
    }
  };

  useEffect(
    () => () => {
      files.forEach((file) => URL.revokeObjectURL(file.preview));
    },
    [files]
  );

  const onDrop = useCallback((acceptedFiles) => {
    setProgress(0);
    setError(null);

    // oneSelect is used to allow only one file to be selected
    if (oneSelect) {
      const file = acceptedFiles[0];
      const mappedFiles = [
        Object.assign(file, {
          preview: URL.createObjectURL(file),
        }),
      ];

      setFiles(mappedFiles);
      // file type check
      if (!types.includes(file.type))
        return setError(
          "Please select valid files (image, video, Audio, PDF, CSV, xls and xlsx)!"
        );
      setImages([file]);
      setError(null);

      const timer = setTimeout(() => {
        autoUpload && handleUpload();
        clearTimeout(timer);
      }, 10);

      return;
    }

    const mappedFiles = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );

    setFiles(mappedFiles);

    const validFiles = acceptedFiles.filter((file) =>
      types.includes(file.type)
    );
    if (validFiles.length) {
      setImages(validFiles);
      setError(null);
    } else {
      setImages([]);
      setError(
        "Please select valid files (image, video, Audio, PDF, CSV, xls and xlsx)!"
      );
    }
    const timer = setTimeout(() => {
      autoUpload && handleUpload();
      clearTimeout(timer);
    }, 10);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true, // Allow multiple files to be dropped
  });

  const getFileIcon = (type) => {
    if (type.startsWith("video"))
      return <Film className="w-8 h-8 text-blue-500" />;
    if (type.startsWith("audio"))
      return <Music className="w-8 h-8 text-purple-500" />;
    if (
      type.includes("spreadsheet") ||
      type.includes("csv") ||
      type.includes("excel")
    )
      return <FileSpreadsheet className="w-8 h-8 text-green-500" />;
    return <FileText className="w-8 h-8 text-gray-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Upload Files</h3>
          <button
            onClick={() => setUploadModal(false)}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 transition-all duration-200 ease-in-out cursor-pointer flex flex-col items-center justify-center gap-4 bg-gray-50/50 hover:bg-gray-50",
              isDragActive
                ? "border-primary bg-primary/5 scale-[0.99]"
                : "border-gray-200 hover:border-primary/50",
              files.length > 0 && "h-auto py-6"
            )}
          >
            {imageOnly ? (
              <input {...getInputProps()} accept="image/*" />
            ) : (
              <input {...getInputProps()} />
            )}

            {files.length === 0 ? (
              <>
                <div className="p-4 rounded-full bg-primary/10 text-primary">
                  <CloudUpload className="w-8 h-8" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-gray-700">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    SVG, PNG, JPG or GIF (max. 800x400px)
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full grid grid-cols-3 gap-4">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="relative group aspect-square rounded-lg overflow-hidden border bg-white shadow-sm"
                  >
                    {file.type.startsWith("image") ? (
                      <img
                        className="w-full h-full object-cover"
                        src={file.preview}
                        alt={`Preview ${index}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        {getFileIcon(file.type)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-xs font-medium truncate px-2">
                        {file.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 text-sm text-red-500 bg-red-50 rounded-lg border border-red-100 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {error}
            </div>
          )}

          {progress > 0 && (
            <div className="mt-4">
              <Progress done={progress} />
              <p className="text-xs text-center text-gray-500 mt-1">
                Uploading... {progress}%
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
          <button
            onClick={() => setUploadModal(false)}
            disabled={progress > 0}
            className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={progress > 0 || files.length === 0}
            className="min-w-[100px] px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {progress > 0 ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImageUpload;
