import { useCallback, useEffect, useState } from 'react'
import Progress from './Progress'
import styles from './ImageUpload.module.css'
import { useDropzone } from 'react-dropzone'
import Compressor from 'compressorjs';

import S3 from 'aws-sdk/clients/s3.js';

const s3 = new S3({
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    signatureVersion: 'v4',
});

const S3_BUCKET = process.env.S3_BUCKET

function ImageUpload({ setUploadModal, setUploadedImage }) {
    const [image, setImage] = useState(null)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState(null)
    const [files, setFiles] = useState([])

    const types = ['image/png', 'image/jpeg']

    const generateRandomName = (file) => {
        const originalName = file.name;
        const extension = originalName.split('.').pop();
        const fileNameWithoutExtension = originalName.replace(`.${extension}`, ''); // Remove the file extension
        const randomString = Math.random().toString(36).substring(7);
        return `${fileNameWithoutExtension}_KMG${randomString}.${extension}`;
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
        if (image) {
            try {
                const compressedFile = await compressImage(image); // Compress the image

                const fileName = generateRandomName(image);

                const params = {
                    Bucket: S3_BUCKET, // Replace with your actual S3 bucket name
                    Key: fileName,
                    Body: compressedFile,
                    ACL: 'public-read', // Set the ACL to public-read to allow public access to the uploaded image
                    ContentType: compressedFile.type, // Set the correct content type explicitly
                };

                const managedUpload = s3.upload(params);

                managedUpload.on('httpUploadProgress', (progress) => {
                    const { loaded, total } = progress;
                    const percentage = Math.round((loaded / total) * 100);
                    setProgress(percentage);
                });

                const uploadResult = await managedUpload.promise();
                console.log("🚀 ~ file: index.js:50 ~ handleUpload ~ uploadResult:", uploadResult)
                setUploadedImage(uploadResult.key)
                setProgress(0);
                setImage(null);
                setUploadModal(false);
            } catch (error) {
                console.error('Error uploading image:', error);
                setError('Something went wrong!');
            }
        } else {
            setError('Please select an image!');
        }
    };

    useEffect(() => () => {
        // Make sure to revoke the data uris to avoid memory leaks
        files.forEach(file => URL.revokeObjectURL(file.preview));
    }, [files]);

    const onDrop = useCallback(acceptedFiles => {
        setProgress(0)
        setFiles(acceptedFiles.map(file => Object.assign(file, {
            preview: URL.createObjectURL(file)
        })))
        let selected = acceptedFiles[0]
        if (selected) {
            if (types.includes(selected.type)) {
                setImage(selected)
                setError(null)
            } else {
                setImage(null)
                setError('Please select an image file (png or jpeg)!')
            }
        } else {
            setImage(null)
            setError('Please select an image file (png or jpeg)!')
        }
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

    return (
        <div className={styles.imageUpload}>
            <div className={styles.imageUpload_content}>
                <div {...getRootProps({ className: 'dropzone' })}>
                    <input {...getInputProps()} />
                    {
                        isDragActive ?
                            <p>Drop the files here ...</p> :
                            (
                                <>
                                    {!!files.length ? <img className="w-72 mx-auto h-72 object-cover rounded-lg" src={files[0]?.preview} alt="Image preview" /> : (
                                        <p>Drag 'n' drop some files here, or click to select files</p>
                                    )}
                                </>
                            )
                    }
                </div>
                <div className={styles.imageUpload_output_wrapper}>
                    <div className={styles.output}>
                        {error && (<div className="text-sm text-red-400">{error}</div>)}
                        {/* {image && (<p>{image.name}</p>)} */}
                        {(progress > 0) && (<Progress done={progress} />)}
                    </div>
                    <button onClick={handleUpload}>Upload</button>
                </div>
            </div>

            <div className={styles.backdrop} onClick={() => setUploadModal(false)}></div>
        </div>
    )
}

export default ImageUpload
