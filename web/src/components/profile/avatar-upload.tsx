'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Camera, Upload, X, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import Cropper from 'react-easy-crop'

type Point = { x: number; y: number }
type Area = { width: number; height: number; x: number; y: number }

interface AvatarUploadProps {
  userId: string
  currentAvatarUrl?: string | null
  onUploadComplete?: (url: string) => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
}

const iconSizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}

export function AvatarUpload({
  userId,
  currentAvatarUrl,
  onUploadComplete,
  size = 'md',
  className,
}: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCropOpen, setIsCropOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const loadImage = (src: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  const getCroppedBlob = async (imageSrc: string, cropArea: Area) => {
    const image = await loadImage(imageSrc)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Failed to process image')
    }

    canvas.width = cropArea.width
    canvas.height = cropArea.height

    ctx.drawImage(
      image,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height,
      0,
      0,
      cropArea.width,
      cropArea.height
    )

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create cropped image'))
            return
          }
          resolve(blob)
        },
        'image/jpeg',
        0.92
      )
    })
  }

  const uploadAvatarFile = async (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPEG, PNG, GIF, or WebP image')
      return
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setError('Image must be less than 5MB')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const fileName = `${userId}/${Date.now()}.jpg`

      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split('/').slice(-2).join('/')
        await supabase.storage.from('avatars').remove([oldPath])
      }

      // Upload new avatar
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw new Error(uploadError.message)
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path)

      const newAvatarUrl = urlData.publicUrl

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', userId)

      if (updateError) {
        console.error('Profile update error:', updateError)
        throw new Error('Failed to update profile')
      }

      setAvatarUrl(newAvatarUrl)
      onUploadComplete?.(newAvatarUrl)
    } catch (err: any) {
      console.error('Avatar upload error:', err)
      setError(err.message || 'Failed to upload avatar')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type and size before opening cropper
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a JPEG, PNG, GIF, or WebP image')
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setError('Image must be less than 5MB')
      return
    }

    setError(null)
    const imageUrl = URL.createObjectURL(file)
    setImageToCrop(imageUrl)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setIsCropOpen(true)
  }

  const handleCropComplete = (_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }

  const handleCancelCrop = () => {
    if (imageToCrop) {
      URL.revokeObjectURL(imageToCrop)
    }
    setImageToCrop(null)
    setIsCropOpen(false)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleConfirmCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) {
      setError('Please adjust the crop area first')
      return
    }

    try {
      const croppedBlob = await getCroppedBlob(imageToCrop, croppedAreaPixels)
      const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' })

      await uploadAvatarFile(croppedFile)
      handleCancelCrop()
    } catch (err: any) {
      console.error('Crop error:', err)
      setError(err.message || 'Failed to crop image')
    }
  }

  const handleRemoveAvatar = async () => {
    if (!avatarUrl) return

    setIsUploading(true)
    setError(null)

    try {
      // Extract path from URL
      const path = avatarUrl.split('/').slice(-2).join('/')

      // Delete from storage
      await supabase.storage.from('avatars').remove([path])

      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId)

      if (updateError) {
        throw new Error('Failed to update profile')
      }

      setAvatarUrl(null)
      onUploadComplete?.('')

    } catch (err: any) {
      console.error('Remove avatar error:', err)
      setError(err.message || 'Failed to remove avatar')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* Avatar Display */}
      <div className="relative group">
        <div
          className={cn(
            'rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-gray-200',
            sizeClasses[size]
          )}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className={cn('text-gray-400', iconSizeClasses[size])} />
          )}

          {/* Loading Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <Spinner size="sm" className="text-white" />
            </div>
          )}
        </div>

        {/* Hover Overlay */}
        <button
          type="button"
          onClick={handleFileSelect}
          disabled={isUploading}
          className={cn(
            'absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer',
            isUploading && 'cursor-not-allowed'
          )}
        >
          <Camera className="w-6 h-6 text-white" />
        </button>

        {/* Remove Button */}
        {avatarUrl && !isUploading && (
          <button
            type="button"
            onClick={handleRemoveAvatar}
            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-sm"
            title="Remove avatar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleFileSelect}
        disabled={isUploading}
        className="flex items-center gap-2"
      >
        {isUploading ? (
          <>
            <Spinner size="sm" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            {avatarUrl ? 'Change Photo' : 'Upload Photo'}
          </>
        )}
      </Button>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-500 text-center">
        JPEG, PNG, GIF or WebP. Max 5MB. You can crop before upload.
      </p>

      {/* Crop Modal */}
      {isCropOpen && imageToCrop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 sm:p-5">
            <div className="mb-3">
              <h3 className="text-base font-semibold text-gray-900">Crop Profile Photo</h3>
              <p className="mt-1 text-sm text-gray-500">Move and zoom your photo to fit the avatar frame.</p>
            </div>

            <div className="relative h-72 w-full overflow-hidden rounded-xl bg-gray-900">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={handleCancelCrop}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" onClick={handleConfirmCrop} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Uploading...
                  </>
                ) : (
                  'Use This Photo'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
