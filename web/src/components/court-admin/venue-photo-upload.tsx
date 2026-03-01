'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'

interface VenuePhotoUploadProps {
    venueId: string
    currentImage?: string | null
    onImageChange: (url: string | null) => void
}

export function VenuePhotoUpload({ venueId, currentImage, onImageChange }: VenuePhotoUploadProps) {
    const [isUploading, setIsUploading] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage || null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const supabase = createClient()

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file')
            return
        }

        // Validate file size (e.g., 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB')
            return
        }

        setIsUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${venueId}-${Date.now()}.${fileExt}`
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

            setPreviewUrl(publicUrl)
            onImageChange(publicUrl)

        } catch (error: any) {
            console.error('Error uploading image:', error)
            alert(error.message || 'Failed to upload image')
        } finally {
            setIsUploading(false)
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleRemoveImage = () => {
        if (confirm('Are you sure you want to remove this image?')) {
            setPreviewUrl(null)
            onImageChange(null)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                    Venue Cover Image
                </label>
            </div>

            <div className="relative group">
                {previewUrl ? (
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                        <Image
                            src={previewUrl}
                            alt="Venue cover"
                            fill
                            className="object-cover"
                        />
                        <button
                            onClick={handleRemoveImage}
                            className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                            title="Remove image"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-video w-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <p className="mb-1 text-sm text-gray-500">
                                <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">SVG, PNG, JPG or GIF (MAX. 5MB)</p>
                        </div>
                    </div>
                )}

                {isUploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />
        </div>
    )
}
