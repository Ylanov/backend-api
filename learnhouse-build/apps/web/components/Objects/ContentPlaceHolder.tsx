'use client';
import React from 'react'
import useAdminStatus from '../Hooks/useAdminStatus'


// Terrible name and terible implementation, need to be refactored asap 
function ContentPlaceHolderIfUserIsNotAdmin({ text }: { text: string }) {
    const isUserAdmin = useAdminStatus() as any
    return (
        <span>{isUserAdmin ? text : 'Пока нет контента'}</span>
    )
}

export default ContentPlaceHolderIfUserIsNotAdmin