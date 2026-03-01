'use client'

import React, { useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export function DownloadReceiptButton() {
    const [isGenerating, setIsGenerating] = useState(false)

    const handleDownload = async () => {
        const receiptElement = document.getElementById('receipt-content')
        if (!receiptElement) return

        try {
            setIsGenerating(true)
            // Save the original classes
            const originalClasses = receiptElement.className

            // Ensure the element is visible and styled properly for capture
            receiptElement.classList.remove('print:hidden')
            receiptElement.classList.add('bg-white', 'p-8') // Add padding for the PDF

            const canvas = await html2canvas(receiptElement, {
                scale: 2, // Higher scale for better quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            })

            // Restore original classes
            receiptElement.className = originalClasses

            const imgWidth = 210 // A4 width in mm
            const pageHeight = 297 // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width
            let heightLeft = imgHeight

            const doc = new jsPDF('p', 'mm', 'a4')
            let position = 0

            doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
            heightLeft -= pageHeight

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight
                doc.addPage()
                doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
                heightLeft -= pageHeight
            }

            // Generate a filename with the current date
            const dateStr = new Date().toISOString().split('T')[0]
            doc.save(`Rallio-Receipt-${dateStr}.pdf`)
        } catch (error) {
            console.error('Error generating PDF:', error)
            alert('Failed to generate PDF receipt. Please try again.')
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isGenerating ? (
                <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating PDF...
                </>
            ) : (
                <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Receipt
                </>
            )}
        </button>
    )
}
