'use client'
import React, { useEffect, useMemo } from 'react'
import styled from 'styled-components'
import Link from 'next/link'
import { Package2, Crown, Shield, User, Users, LogOut, User as UserIcon, ChevronDown } from 'lucide-react'
import UserAvatar from '@components/Objects/UserAvatar'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithoutOrg } from '@services/config/config'
import Tooltip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu"
import { signOut } from 'next-auth/react'

interface RoleInfo {
  name: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  description: string;
}

interface CustomRoleInfo {
  name: string;
  description?: string;
}

export const HeaderProfileBox = () => {
  const session = useLHSession() as any
  const { isAdmin, loading, userRoles, rights } = useAdminStatus()
  const org = useOrg() as any

  useEffect(() => { }
    , [session])

  const userRoleInfo = useMemo((): RoleInfo | null => {
    if (!userRoles || userRoles.length === 0) return null;

    // Находим роль с наивысшим приоритетом для текущей организации
    const orgRoles = userRoles.filter((role: any) => role.org.id === org?.id);
    
    if (orgRoles.length === 0) return null;

    // Сортируем по приоритету ролей (админ > мейнтейнер > инструктор > пользователь)
    const sortedRoles = orgRoles.sort((a: any, b: any) => {
      const getRolePriority = (role: any) => {
        if (role.role.role_uuid === 'role_global_admin' || role.role.id === 1) return 4;
        if (role.role.role_uuid === 'role_global_maintainer' || role.role.id === 2) return 3;
        if (role.role.role_uuid === 'role_global_instructor' || role.role.id === 3) return 2;
        return 1;
      };
      return getRolePriority(b) - getRolePriority(a);
    });

    const highestRole = sortedRoles[0];

    // Определяем конфигурации ролей на основе фактических ролей из базы данных
    const roleConfigs: { [key: string]: RoleInfo } = {
      'role_global_admin': {
        name: 'ADMIN',
        icon: <Crown size={12} />,
        bgColor: 'bg-purple-600',
        textColor: 'text-white',
        description: 'Полный контроль платформы со всеми разрешениями'
      },
      'role_global_maintainer': {
        name: 'MAINTAINER',
        icon: <Shield size={12} />,
        bgColor: 'bg-blue-600',
        textColor: 'text-white',
        description: 'Менеджер среднего уровня с широкими разрешениями'
      },
      'role_global_instructor': {
        name: 'INSTRUCTOR',
        icon: <Users size={12} />,
        bgColor: 'bg-green-600',
        textColor: 'text-white',
        description: 'Может управлять своим собственным контентом'
      },
      'role_global_user': {
        name: 'USER',
        icon: <User size={12} />,
        bgColor: 'bg-gray-500',
        textColor: 'text-white',
        description: 'Обучающийся с доступом только для чтения'
      }
    };

    // Определяем роль на основе role_uuid или id
    let roleKey = 'role_global_user'; // default
    if (highestRole.role.role_uuid) {
      roleKey = highestRole.role.role_uuid;
    } else if (highestRole.role.id === 1) {
      roleKey = 'role_global_admin';
    } else if (highestRole.role.id === 2) {
      roleKey = 'role_global_maintainer';
    } else if (highestRole.role.id === 3) {
      roleKey = 'role_global_instructor';
    }

    return roleConfigs[roleKey] || roleConfigs['role_global_user'];
  }, [userRoles, org?.id]);

  const customRoles = useMemo((): CustomRoleInfo[] => {
    if (!userRoles || userRoles.length === 0) return [];

    // Находим роли для текущей организации
    const orgRoles = userRoles.filter((role: any) => role.org.id === org?.id);
    
    if (orgRoles.length === 0) return [];

    // Фильтруем кастомные роли (не системные роли)
    const customRoles = orgRoles.filter((role: any) => {
      // Проверяем, является ли роль системной
      const isSystemRole = 
        role.role.role_uuid?.startsWith('role_global_') ||
        [1, 2, 3, 4].includes(role.role.id) ||
        ['Admin', 'Maintainer', 'Instructor', 'User'].includes(role.role.name);
      
      return !isSystemRole;
    });

    return customRoles.map((role: any) => ({
      name: role.role.name || 'Custom Role',
      description: role.role.description
    }));
  }, [userRoles, org?.id]);

  return (
    <ProfileArea>
      {session.status == 'unauthenticated' && (
        <UnidentifiedArea className="flex text-sm text-gray-700 font-bold p-1.5 px-2 rounded-lg">
          <ul className="flex space-x-3 items-center">
            <li>
              <Link
                href={{ pathname: getUriWithoutOrg('/login'), query: org ? { orgslug: org.slug } : null }} >Login</Link>
            </li>
            <li className="bg-black rounded-lg shadow-md p-2 px-3 text-white">
              <Link href={{ pathname: getUriWithoutOrg('/signup'), query: org ? { orgslug: org.slug } : null }}>Sign up</Link>
            </li>
          </ul>
        </UnidentifiedArea>
      )}
      {session.status == 'authenticated' && (
        <AccountArea className="space-x-0">
          <div className="flex items-center space-x-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="cursor-pointer flex items-center space-x-3 hover:bg-gray-50 rounded-lg p-2 transition-colors">
                  <UserAvatar border="border-2" rounded="rounded-lg" width={30} />
                  <div className="flex flex-col space-y-0">
                    <div className="flex items-center space-x-2">
                      <p className='text-sm font-semibold text-gray-900 capitalize'>{session.data.user.username}</p>
                      {userRoleInfo && userRoleInfo.name !== 'USER' && (
                        <Tooltip 
                          content={userRoleInfo.description}
                          sideOffset={15}
                          side="bottom"
                        >
                          <div className={`text-[6px] ${userRoleInfo.bgColor} ${userRoleInfo.textColor} px-1 py-0.5 font-medium rounded-full flex items-center gap-0.5 w-fit`}>
                            {userRoleInfo.icon}
                            {userRoleInfo.name}
                          </div>
                        </Tooltip>
                      )}
                      {/* Custom roles */}
                      {customRoles.map((customRole, index) => (
                        <Tooltip 
                          key={index}
                          content={customRole.description || `Custom role: ${customRole.name}`}
                          sideOffset={15}
                          side="bottom"
                        >
                          <div className="text-[6px] bg-gray-500 text-white px-1 py-0.5 font-medium rounded-full flex items-center gap-0.5 w-fit">
                            <Shield size={12} />
                            {customRole.name}
                          </div>
                        </Tooltip>
                      ))}
                    </div>
                    <p className='text-xs text-gray-500'>{session.data.user.email}</p>
                  </div>
                  <ChevronDown size={16} className="text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  <div className="flex items-center space-x-2">
                    <UserAvatar border="border-2" rounded="rounded-full" width={24} />
                    <div>
                      <p className="text-sm font-medium">{session.data.user.username}</p>
                      <p className="text-xs text-gray-500 capitalize">{session.data.user.email}</p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {rights?.dashboard?.action_access && (
                  <DropdownMenuItem asChild>
                    <Link href="/dash" className="flex items-center space-x-2">
                      <Shield size={16} />
                      <span>Панель управления</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/dash/user-account/settings/general" className="flex items-center space-x-2">
                    <UserIcon size={16} />
                    <span>Настройки пользователя</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dash/user-account/owned" className="flex items-center space-x-2">
                    <Package2 size={16} />
                    <span>Мои курсы</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="flex items-center space-x-2 text-red-600 focus:text-red-600"
                >
                  <LogOut size={16} />
                  <span>Выйти</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </AccountArea>
      )}
    </ProfileArea>
  )
}

const AccountArea = styled.div`
  display: flex;
  place-items: center;

  img {
    width: 29px;
  }
`

const ProfileArea = styled.div`
  display: flex;
  place-items: stretch;
  place-items: center;
`

const UnidentifiedArea = styled.div`
  display: flex;
  place-items: stretch;
  grow: 1;
`
