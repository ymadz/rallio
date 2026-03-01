'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'

interface VenuePhotoUploadProps {
    venueId: string
    currentImages?: string[]
    onImagesChange: (urls: string[]) => void
    maxImages?: number
}

export function VenuePhotoUpload({ venueId, currentImages = [], onImagesChange, maxImages = 10 }: VenuePhotoUploadProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [previewUrls, setPreviewUrls] = useState<string[]>(currentImages || [])
    const fileInputRef = useRef<HTMLInputElement>(null)

    const supabase = createClient()

    useEffect(() => {
        setPreviewUrls(currentImages || [])
    }, [currentImages])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        if (previewUrls.length + files.length > maxImages) {
            alert(`You can only upload up to ${maxImages} images in total.`)
            return
        }

        setIsUploading(true)
        const newUrls: string[] = []

        try {
            for (const file of files) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    alert(`File ${file.name} is not an image and was skipped.`)
                    continue
                }

                // Validate file size (e.g., 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert(`File ${file.name} size exceeds 5MB and was skipped.`)
                    continue
                }

                const fileExt = file.name.split('.').pop()
                const fileName = `${venueId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
                const filePath = `${fileName}`

                // Upload to Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from('venue-images')
                    .upload(filePath, file)

                if (uploadError) {
                    throw uploadError
                }

                // Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('venue-images')
                    .getPublicUrl(filePath)

                newUrls.push(publicUrl)
            }

            const updatedUrls = [...previewUrls, ...newUrls]
            setPreviewUrls(updatedUrls)
            onImagesChange(updatedUrls)

        } catch (error: any) {
            console.error('Error uploading images:', error)
            alert(error.message || 'Failed to upload images')
        } finally {
            setIsUploading(false)
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleRemoveImage = (indexToRemove: number) => {
        if (confirm('Are you sure you want to remove this image?')) {
            const updatedUrls = previewUrls.filter((_, index) => index !== indexToRemove)
            setPreviewUrls(updatedUrls)
            onImagesChange(updatedUrls)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                    Venue Images <span className="text-gray-500 font-normal text-xs">({previewUrls.length}/{maxImages})</span>
                </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {previewUrls.map((url, index) => (
                    <div key={url} className="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100 group">
                        <Image
                            src={url}
                            alt={`Venue image ${index + 1}`}
                            fill
                            className="object-cover"
                        />
                        <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-sm"
                            title="Remove image"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        {index === 0 && (
                            <span className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded-md backdrop-blur-sm shadow-sm">
                                Cover
                            </span>
                        )}
                    </div>
                ))}

                {previewUrls.length < maxImages && (
                    <div className="relative group">
                        <div
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            className={`aspect-video w-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer'}`}
                        >
                            <div className="flex flex-col items-center justify-center p-4 text-center">
                                <Upload className="w-6 h-6 text-gray-400 mb-2" />
                                <p className="mb-1 text-xs text-gray-500 font-medium">
                                    Click to upload
                                </p>
                                <p className="text-[10px] text-gray-400">Max {maxImages} images</p>
                            </div>
                        </div>

                        {isUploading && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-lg">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
            />
        </div>
    )
}

