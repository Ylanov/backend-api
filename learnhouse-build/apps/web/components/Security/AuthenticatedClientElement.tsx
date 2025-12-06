'use client'
import React from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'

interface AuthenticatedClientElementProps {
  children: React.ReactNode
  checkMethod: 'authentication' | 'roles'
  orgId?: string
  ressourceType?:
  | 'collections'
  | 'courses'
  | 'activities'
  | 'users'
  | 'organizations'
  action?: 'create' | 'update' | 'delete' | 'read'
}

export const AuthenticatedClientElement = (
  props: AuthenticatedClientElementProps
) => {
  const [isAllowed, setIsAllowed] = React.useState(false)
  const session = useLHSession() as any
  const org = useOrg() as any

  function isUserAllowed(
    roles: any[],
    action: string,
    resourceType: string,
    org_uuid: string
  ): boolean {
    // Итерация по ролям пользователя
    for (const role of roles) {
      // Проверка, относится ли роль к правильной организации
      if (role.org.org_uuid === org_uuid) {
        // Проверка, есть ли у пользователя роль для данного типа ресурса
        if (role.role.rights && role.role.rights[resourceType]) {
          // Проверка, разрешено ли пользователю выполнять действие
          const actionKey = `action_${action}`
          if (role.role.rights[resourceType][actionKey] === true) {
            return true
          }
        }
      }
    }

    // Если ни одна роль не соответствует организации, типу ресурса и действию, возвращаем false
    return false
  }

  function check() {
    if (session.status == 'unauthenticated') {
      setIsAllowed(false)
      return
    } else {
      if (props.checkMethod === 'authentication') {
        setIsAllowed(session.status == 'authenticated')
      } else if (props.checkMethod === 'roles' ) {
        return setIsAllowed(
          isUserAllowed(
            session?.data?.roles,
            props.action!,
            props.ressourceType!,
            org?.org_uuid
          )
        )
      }
    }
  }

  React.useEffect(() => {
    if (session.status == 'loading') {
      return
    }

    check()
  }, [session.data, org])

  return <>{isAllowed && props.children}</>
}

export default AuthenticatedClientElement
