'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import { Backpack, BadgeDollarSign, BookCopy, Home, School, Settings, Users } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'

function DashMobileMenu() {
  const org = useOrg() as any
  const session = useLHSession() as any

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-lg text-white shadow-xl">
      <div className="flex justify-around items-center h-16 px-2">
        <AdminAuthorization authorizationMode="component">

          <ToolTip content={'Главная'} slateBlack sideOffset={8} side="top">
            <Link
              href={`/`}
              className="flex flex-col items-center p-2"
              aria-label="Перейти на главную панель"
            >
              <Home size={20} />
              <span className="text-xs mt-1">Главная</span>
            </Link>
          </ToolTip>

          <ToolTip content={'Курсы'} slateBlack sideOffset={8} side="top">
            <Link
              href={`/dash/courses`}
              className="flex flex-col items-center p-2"
              aria-label="Управление курсами"
            >
              <BookCopy size={20} />
              <span className="text-xs mt-1">Курсы</span>
            </Link>
          </ToolTip>

          <ToolTip content={'Задания'} slateBlack sideOffset={8} side="top">
            <Link
              href={`/dash/assignments`}
              className="flex flex-col items-center p-2"
              aria-label="Управление заданиями"
            >
              <Backpack size={20} />
              <span className="text-xs mt-1">Задания</span>
            </Link>
          </ToolTip>

          <ToolTip content={'Платежи'} slateBlack sideOffset={8} side="top">
            <Link
              href={`/dash/payments/customers`}
              className="flex flex-col items-center p-2"
              aria-label="Управление платежами и биллингом"
            >
              <BadgeDollarSign size={20} />
              <span className="text-xs mt-1">Платежи</span>
            </Link>
          </ToolTip>

          <ToolTip content={'Пользователи'} slateBlack sideOffset={8} side="top">
            <Link
              href={`/dash/users/settings/users`}
              className="flex flex-col items-center p-2"
              aria-label="Управление пользователями"
            >
              <Users size={20} />
              <span className="text-xs mt-1">Пользователи</span>
            </Link>
          </ToolTip>

          <ToolTip content={'Организация'} slateBlack sideOffset={8} side="top">
            <Link
              href={`/dash/org/settings/general`}
              className="flex flex-col items-center p-2"
              aria-label="Настройки организации"
            >
              <School size={20} />
              <span className="text-xs mt-1">Орг.</span>
            </Link>
          </ToolTip>

        </AdminAuthorization>

        <ToolTip
          content={`Настройки пользователя ${session.data.user.username}`}
          slateBlack
          sideOffset={8}
          side="top"
        >
          <Link
            href={'/dash/user-account/settings/general'}
            className="flex flex-col items-center p-2"
            aria-label="Настройки учетной записи"
          >
            <Settings size={20} />
            <span className="text-xs mt-1">Настройки</span>
          </Link>
        </ToolTip>

      </div>
    </div>
  )
}

export default DashMobileMenu
