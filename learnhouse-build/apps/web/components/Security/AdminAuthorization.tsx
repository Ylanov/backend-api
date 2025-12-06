'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { usePathname, useRouter } from 'next/navigation';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { getUriWithoutOrg } from '@services/config/config';
import { useOrg } from '@components/Contexts/OrgContext';

type AuthorizationProps = {
  children: React.ReactNode;
  authorizationMode: 'component' | 'page';
};

const ADMIN_PATHS = [
  '/dash/org/*',
  '/dash/org',
  '/dash/users/*',
  '/dash/users',
  '/dash/courses/*',
  '/dash/courses',
  '/dash/org/settings/general',
];

const AdminAuthorization: React.FC<AuthorizationProps> = ({ children, authorizationMode }) => {
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, loading } = useAdminStatus() as any
  const [isAuthorized, setIsAuthorized] = useState(false);

  const isUserAuthenticated = useMemo(() => session.status === 'authenticated', [session.status]);

  const checkPathname = useCallback((pattern: string, pathname: string) => {
    // Убедиться, что входные данные являются строками
    if (typeof pattern !== 'string' || typeof pathname !== 'string') {
      return false;
    }

    // Преобразование шаблона в регулярное выражение
    const regexPattern = new RegExp(`^${pattern.replace(/[\/.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`);

    // Проверка пути на соответствие регулярному выражению
    return regexPattern.test(pathname);
  }, []);


  const isAdminPath = useMemo(() => ADMIN_PATHS.some(path => checkPathname(path, pathname)), [pathname, checkPathname]);

  const authorizeUser = useCallback(() => {
    if (loading) {
      return; // Подождать, пока определится статус администратора
    }

    if (!isUserAuthenticated) {
      router.push(getUriWithoutOrg('/login?orgslug=' + org.slug));
      return;
    }

    if (authorizationMode === 'page') {
      if (isAdminPath) {
        if (isAdmin) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
          router.push('/dash');
        }
      } else {
        setIsAuthorized(true);
      }
    } else if (authorizationMode === 'component') {
      setIsAuthorized(isAdmin);
    }
  }, [loading, isUserAuthenticated, isAdmin, isAdminPath, authorizationMode, router]);

  useEffect(() => {
    authorizeUser();
  }, [authorizeUser]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <PageLoading />
      </div>
    );
  }

  if (authorizationMode === 'page' && !isAuthorized) {
    return (
      <div className="flex justify-center items-center h-screen">
        <h1 className="text-2xl">Вы не авторизованы для доступа к этой странице</h1>
      </div>
    );
  }

  return <>{isAuthorized && children}</>;
};

export default AdminAuthorization;
