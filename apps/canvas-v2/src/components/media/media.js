import React, { useState } from "react";
import ImageUpload from "../shared/ImageUpload";
import { imageGetUrl } from "@/utils/utils";
import { Upload } from "lucide-react";

function Media({ setImages, images, title }) {
  const [uploadModal, setUploadModal] = useState(false);

  const handleUrlChange = (e) => {
    setImages(imageGetUrl(e.target.value));
  };

  const handleUploadComplete = (newFiles) => {
    if (newFiles && newFiles.length > 0) {
      const newUrl = newFiles[newFiles.length - 1];
      setImages(newUrl);
    }
    setUploadModal(false);
  };

  return (
    <>
      <div className="rounded-md p-5 mb-8 bg-white shadow">
        <h4 className="text-title font-medium mb-4">{title}</h4>

        {images && (
          <div className="mb-4 w-full h-60 relative overflow-hidden rounded-md border border-borderGray bg-gray-50">
            <img
              src={imageGetUrl(images)}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={imageGetUrl(images) || ""}
            onChange={handleUrlChange}
            placeholder="Add Image URL"
            className="flex-1 bg-white rounded py-2 px-4 outline-none border border-borderGray focus:border-title transition-colors"
          />
          <button
            onClick={() => setUploadModal(true)}
            className="shrink-0 flex items-center justify-center px-4 py-2 border border-borderGray rounded-md bg-white hover:bg-gray-50 transition-colors text-sm font-medium"
            title="Upload Image"
          >
            <Upload size={16} className="mr-2" />
            Upload
          </button>
        </div>
      </div>

      {/* modal for upload image */}
      {uploadModal && (
        <ImageUpload
          setUploadedImage={handleUploadComplete}
          setUploadModal={setUploadModal}
          images={[]}
          oneSelect={true}
        />
      )}
    </>
  );
}

export default Media;
