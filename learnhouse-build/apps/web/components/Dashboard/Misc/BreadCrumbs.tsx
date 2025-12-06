'use client';
import { useOrg } from '@components/Contexts/OrgContext';
import { Backpack, Book, ChevronRight, CreditCard, School, User, Users } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

type BreadCrumbsProps = {
  type: 'courses' | 'user' | 'users' | 'org' | 'orgusers' | 'assignments' | 'payments'
  last_breadcrumb?: string
}

function BreadCrumbs(props: BreadCrumbsProps) {
  const org = useOrg() as any

  return (
    <div>
      <div className="h-7"></div>
      <div className="text-gray-400 tracking-tight font-medium text-sm flex space-x-1">
        <div className="flex items-center space-x-1">

          {props.type == 'courses' ? (
            <div className="flex space-x-2 items-center">
              <Book className="text-gray" size={14} />
              <Link href="/dash/courses">Курсы</Link>
            </div>
          ) : ''}

          {props.type == 'assignments' ? (
            <div className="flex space-x-2 items-center">
              <Backpack className="text-gray" size={14} />
              <Link href="/dash/assignments">Задания</Link>
            </div>
          ) : ''}

          {props.type == 'user' ? (
            <div className="flex space-x-2 items-center">
              <User className="text-gray" size={14} />
              <Link href="/dash/user-account/settings/general">
                Настройки аккаунта
              </Link>
            </div>
          ) : ''}

          {props.type == 'orgusers' ? (
            <div className="flex space-x-2 items-center">
              <Users className="text-gray" size={14} />
              <Link href="/dash/users/settings/users">
                Пользователи организации
              </Link>
            </div>
          ) : ''}

          {props.type == 'org' ? (
            <div className="flex space-x-2 items-center">
              <School className="text-gray" size={14} />
              <Link href="/dash/users">
                Настройки организации
              </Link>
            </div>
          ) : ''}

          {props.type == 'payments' ? (
            <div className="flex space-x-2 items-center">
              <CreditCard className="text-gray" size={14} />
              <Link href="/dash/payments">Платежи</Link>
            </div>
          ) : ''}

          <div className="flex items-center space-x-1 first-letter:uppercase">
            {props.last_breadcrumb ? <ChevronRight size={17} /> : ''}
            <div className="first-letter:uppercase">
              {props.last_breadcrumb}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default BreadCrumbs
