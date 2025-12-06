import React, { useEffect, useState } from 'react'
import { getUriWithOrg } from '@services/config/config'
import { useParams } from 'next/navigation'
import { getUserAvatarMediaDirectory } from '@services/media/media'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import UserProfilePopup from './UserProfilePopup'
import { getUserByUsername } from '@services/users/users'

type UserAvatarProps = {
  width?: number
  avatar_url?: string
  use_with_session?: boolean
  rounded?: 'rounded-md' | 'rounded-xl' | 'rounded-lg' | 'rounded-full' | 'rounded'
  border?: 'border-2' | 'border-4' | 'border-8'
  borderColor?: string
  predefined_avatar?: 'ai' | 'empty'
  backgroundColor?: 'bg-white' | 'bg-gray-100' 
  showProfilePopup?: boolean
  userId?: string
  username?: string
}

function UserAvatar(props: UserAvatarProps) {
  const session = useLHSession() as any
  const params = useParams() as any
  const [userData, setUserData] = useState<any>(null)

  useEffect(() => {
    const fetchUserByUsername = async () => {
      if (props.username) {
        try {
          const data = await getUserByUsername(props.username)
          setUserData(data)
        } catch (error) {
          console.error('Ошибка при получении пользователя по имени:', error)
        }
      }
    }

    fetchUserByUsername()
  }, [props.username])

  const isExternalUrl = (url: string): boolean => {
    return url.startsWith('http://') || url.startsWith('https://')
  }

  const extractExternalUrl = (url: string): string | null => {
    // Проверяем, содержит ли URL встроенный внешний URL
    const matches = url.match(/avatars\/(https?:\/\/[^/]+.*$)/)
    if (matches && matches[1]) {
      return matches[1]
    }
    return null
  }

  const getAvatarUrl = (): string => {
    // Если указан предопределенный аватар
    if (props.predefined_avatar) {
      const avatarType = props.predefined_avatar === 'ai' ? 'ai_avatar.png' : 'empty_avatar.png'
      return getUriWithOrg(params.orgslug, `/${avatarType}`)
    }

    // Если предоставлен avatar_url пропс
    if (props.avatar_url) {
      // Проверяем, является ли это некорректным URL (внешний URL, обработанный через getUserAvatarMediaDirectory)
      const extractedUrl = extractExternalUrl(props.avatar_url)
      if (extractedUrl) {
        return extractedUrl
      }
      // Если это прямой внешний URL
      if (isExternalUrl(props.avatar_url)) {
        return props.avatar_url
      }
      // Иначе используем как есть
      return props.avatar_url
    }

    // Если у нас есть данные пользователя из поиска по имени
    if (userData?.avatar_image) {
      const avatarUrl = userData.avatar_image
      // Если это внешний URL (например, из Google, Facebook и т.д.), используем его напрямую
      if (isExternalUrl(avatarUrl)) {
        return avatarUrl
      }
      // Иначе получаем локальный URL аватара
      return getUserAvatarMediaDirectory(userData.user_uuid, avatarUrl)
    }

    // Если у пользователя есть аватар в сессии (только если сессия существует)
    if (session?.data?.user?.avatar_image) {
      const avatarUrl = session.data.user.avatar_image
      // Если это внешний URL (например, из Google, Facebook и т.д.), используем его напрямую
      if (isExternalUrl(avatarUrl)) {
        return avatarUrl
      }
      //  Иначе получаем локальный URL аватара
      return getUserAvatarMediaDirectory(session.data.user.user_uuid, avatarUrl)
    }

    //  Запасной вариант - пустой аватар
    return getUriWithOrg(params.orgslug, '/empty_avatar.png')
  }

  const avatarImage = (
    <img
      alt="Аватар пользователя"
      width={props.width ?? 50}
      height={props.width ?? 50}
      src={getAvatarUrl()}
      className={`
        ${props.avatar_url && session?.data?.user?.avatar_image ? '' : 'bg-gray-700'}
        ${props.border ? `border ${props.border}` : ''}
        ${props.borderColor ?? 'border-white'}
        ${props.backgroundColor ?? 'bg-gray-100'}
        shadow-md shadow-gray-300/45
        aspect-square
        w-[${props.width ?? 50}px]
        h-[${props.width ?? 50}px]
        ${props.rounded ?? 'rounded-xl'}
      `}
    />
  )

  if (props.showProfilePopup && (props.userId || (userData?.id))) {
    return (
      <UserProfilePopup userId={props.userId || userData?.id}>
        {avatarImage}
      </UserProfilePopup>
    )
  }

  return avatarImage
}

export default UserAvatar
