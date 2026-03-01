'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Upload, X } from 'lucide-react'
import Image from 'next/image'

interface VenueGalleryUploadProps {
    venueId: string
    currentImages?: string[]
    onImagesChange: (urls: string[]) => void
    maxImages?: number
}

export function VenueGalleryUpload({ venueId, currentImages = [], onImagesChange, maxImages = 10 }: VenueGalleryUploadProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [images, setImages] = useState<string[]>(currentImages || [])
    const fileInputRef = useRef<HTMLInputElement>(null)

    const supabase = createClient()

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        // Limit check
        if (images.length + files.length > maxImages) {
            alert(`You can only upload up to ${maxImages} images.`)
            if (fileInputRef.current) fileInputRef.current.value = ''
            return
        }

        setIsUploading(true)
        const newUrls: string[] = [...images]

        try {
            for (const file of files) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    console.warn('Skipping non-image file:', file.name)
                    continue
                }

                // Validate file size (e.g., 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    console.warn('Skipping large file:', file.name)
                    continue
                }

                const fileExt = file.name.split('.').pop()
                const fileName = `${venueId}-gallery-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
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

            setImages(newUrls)
            onImagesChange(newUrls)

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
            const newUrls = images.filter((_, index) => index !== indexToRemove)
            setImages(newUrls)
            onImagesChange(newUrls)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                    Gallery Images ({images.length} / {maxImages})
                </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((url, index) => (
                    <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                        <Image
                            src={url}
                            alt={`Gallery image ${index + 1}`}
                            fill
                            className="object-cover"
                        />
                        <button
                            onClick={() => handleRemoveImage(index)}
                            className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-sm"
                            title="Remove image"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}

                {images.length < maxImages && (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative"
                    >
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                            <Upload className="w-6 h-6 text-gray-400 mb-2" />
                            <p className="text-xs text-gray-500 font-medium">Add Photo</p>
                        </div>
                        {isUploading && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
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
            <p className="text-xs text-gray-500">
                Upload up to {maxImages} images to show multiple angles of your venue. SVG, PNG, JPG or GIF (MAX. 5MB)
            </p>
        </div>
    )
}
