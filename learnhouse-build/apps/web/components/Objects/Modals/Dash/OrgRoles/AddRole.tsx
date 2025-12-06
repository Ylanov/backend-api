'use client'
import FormLayout, {
    FormField,
    FormLabelAndMessage,
    Input,
    Textarea,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { useOrg } from '@components/Contexts/OrgContext'
import React from 'react'
import { createRole } from '@services/roles/roles'
import { mutate } from 'swr'
import { getAPIUrl } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useFormik } from 'formik'
import toast from 'react-hot-toast'
import { Shield, BookOpen, Users, UserCheck, FolderOpen, Building, FileText, Activity, Monitor, CheckSquare, Square } from 'lucide-react'

type AddRoleProps = {
    setCreateRoleModal: any
}

interface Rights {
    courses: {
        action_create: boolean;
        action_read: boolean;
        action_read_own: boolean;
        action_update: boolean;
        action_update_own: boolean;
        action_delete: boolean;
        action_delete_own: boolean;
    };
    users: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    usergroups: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    collections: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    organizations: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    coursechapters: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    activities: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    roles: {
        action_create: boolean;
        action_read: boolean;
        action_update: boolean;
        action_delete: boolean;
    };
    dashboard: {
        action_access: boolean;
    };
}

const validate = (values: any) => {
    const errors: any = {}

    if (!values.name) {
        errors.name = 'Обязательно'
    } else if (values.name.length < 2) {
        errors.name = 'Название должно содержать не менее 2 символов'
    }

    if (!values.description) {
        errors.description = 'Обязательно'
    } else if (values.description.length < 10) {
        errors.description = 'Описание должно содержать не менее 10 символов'
    }

    return errors
}

const defaultRights: Rights = {
    courses: {
        action_create: false,
        action_read: false,
        action_read_own: false,
        action_update: false,
        action_update_own: false,
        action_delete: false,
        action_delete_own: false
    },
    users: {
        action_create: false,
        action_read: false,
        action_update: false,
        action_delete: false
    },
    usergroups: {
        action_create: false,
        action_read: false,
        action_update: false,
        action_delete: false
    },
    collections: {
        action_create: false,
        action_read: false,
        action_update: false,
        action_delete: false
    },
    organizations: {
        action_create: false,
        action_read: false,
        action_update: false,
        action_delete: false
    },
    coursechapters: {
        action_create: false,
        action_read: false,
        action_update: false,
        action_delete: false
    },
    activities: {
        action_create: false,
        action_read: false,
        action_update: false,
        action_delete: false
    },
    roles: {
        action_create: false,
        action_read: false,
        action_update: false,
        action_delete: false
    },
    dashboard: {
        action_access: false
    }
}

const predefinedRoles = {
    'Admin': {
        name: 'Администратор',
        description: 'Полный контроль над платформой со всеми правами',
        rights: {
            courses: { action_create: true, action_read: true, action_read_own: true, action_update: true, action_update_own: true, action_delete: true, action_delete_own: true },
            users: { action_create: true, action_read: true, action_update: true, action_delete: true },
            usergroups: { action_create: true, action_read: true, action_update: true, action_delete: true },
            collections: { action_create: true, action_read: true, action_update: true, action_delete: true },
            organizations: { action_create: true, action_read: true, action_update: true, action_delete: true },
            coursechapters: { action_create: true, action_read: true, action_update: true, action_delete: true },
            activities: { action_create: true, action_read: true, action_update: true, action_delete: true },
            roles: { action_create: true, action_read: true, action_update: true, action_delete: true },
            dashboard: { action_access: true }
        }
    },
    'Course Manager': {
        name: 'Менеджер курсов',
        description: 'Может управлять курсами, главами и активностями',
        rights: {
            courses: { action_create: true, action_read: true, action_read_own: true, action_update: true, action_update_own: true, action_delete: false, action_delete_own: true },
            users: { action_create: false, action_read: true, action_update: false, action_delete: false },
            usergroups: { action_create: false, action_read: true, action_update: false, action_delete: false },
            collections: { action_create: true, action_read: true, action_update: true, action_delete: false },
            organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
            coursechapters: { action_create: true, action_read: true, action_update: true, action_delete: false },
            activities: { action_create: true, action_read: true, action_update: true, action_delete: false },
            roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
            dashboard: { action_access: true }
        }
    },
    'Instructor': {
        name: 'Инструктор',
        description: 'Может создавать и управлять своими курсами',
        rights: {
            courses: { action_create: true, action_read: true, action_read_own: true, action_update: false, action_update_own: true, action_delete: false, action_delete_own: true },
            users: { action_create: false, action_read: false, action_update: false, action_delete: false },
            usergroups: { action_create: false, action_read: false, action_update: false, action_delete: false },
            collections: { action_create: false, action_read: true, action_update: false, action_delete: false },
            organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
            coursechapters: { action_create: true, action_read: true, action_update: false, action_delete: false },
            activities: { action_create: true, action_read: true, action_update: false, action_delete: false },
            roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
            dashboard: { action_access: true }
        }
    },
    'Viewer': {
        name: 'Наблюдатель',
        description: 'Доступ только для чтения к курсам и контенту',
        rights: {
            courses: { action_create: false, action_read: true, action_read_own: true, action_update: false, action_update_own: false, action_delete: false, action_delete_own: false },
            users: { action_create: false, action_read: false, action_update: false, action_delete: false },
            usergroups: { action_create: false, action_read: false, action_update: false, action_delete: false },
            collections: { action_create: false, action_read: true, action_update: false, action_delete: false },
            organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
            coursechapters: { action_create: false, action_read: true, action_update: false, action_delete: false },
            activities: { action_create: false, action_read: true, action_update: false, action_delete: false },
            roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
            dashboard: { action_access: true }
        }
    },
    'Content Creator': {
        name: 'Создатель контента',
        description: 'Может создавать и редактировать контент, но не управлять пользователями',
        rights: {
            courses: { action_create: true, action_read: true, action_read_own: true, action_update: true, action_update_own: true, action_delete: false, action_delete_own: false },
            users: { action_create: false, action_read: false, action_update: false, action_delete: false },
            usergroups: { action_create: false, action_read: false, action_update: false, action_delete: false },
            collections: { action_create: true, action_read: true, action_update: true, action_delete: false },
            organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
            coursechapters: { action_create: true, action_read: true, action_update: true, action_delete: false },
            activities: { action_create: true, action_read: true, action_update: true, action_delete: false },
            roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
            dashboard: { action_access: true }
        }
    },
    'User Manager': {
        name: 'Менеджер пользователей',
        description: 'Может управлять пользователями и группами пользователей',
        rights: {
            courses: { action_create: false, action_read: true, action_read_own: true, action_update: false, action_update_own: false, action_delete: false, action_delete_own: false },
            users: { action_create: true, action_read: true, action_update: true, action_delete: true },
            usergroups: { action_create: true, action_read: true, action_update: true, action_delete: true },
            collections: { action_create: false, action_read: true, action_update: false, action_delete: false },
            organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
            coursechapters: { action_create: false, action_read: true, action_update: false, action_delete: false },
            activities: { action_create: false, action_read: true, action_update: false, action_delete: false },
            roles: { action_create: false, action_read: true, action_update: false, action_delete: false },
            dashboard: { action_access: true }
        }
    },
    'Moderator': {
        name: 'Модератор',
        description: 'Может модерировать контент и управлять активностями',
        rights: {
            courses: { action_create: false, action_read: true, action_read_own: true, action_update: false, action_update_own: false, action_delete: false, action_delete_own: false },
            users: { action_create: false, action_read: true, action_update: false, action_delete: false },
            usergroups: { action_create: false, action_read: true, action_update: false, action_delete: false },
            collections: { action_create: false, action_read: true, action_update: true, action_delete: false },
            organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
            coursechapters: { action_create: false, action_read: true, action_update: true, action_delete: false },
            activities: { action_create: false, action_read: true, action_update: true, action_delete: false },
            roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
            dashboard: { action_access: true }
        }
    },
    'Analyst': {
        name: 'Аналитик',
        description: 'Доступ только для чтения с возможностями аналитики',
        rights: {
            courses: { action_create: false, action_read: true, action_read_own: true, action_update: false, action_update_own: false, action_delete: false, action_delete_own: false },
            users: { action_create: false, action_read: true, action_update: false, action_delete: false },
            usergroups: { action_create: false, action_read: true, action_update: false, action_delete: false },
            collections: { action_create: false, action_read: true, action_update: false, action_delete: false },
            organizations: { action_create: false, action_read: true, action_update: false, action_delete: false },
            coursechapters: { action_create: false, action_read: true, action_update: false, action_delete: false },
            activities: { action_create: false, action_read: true, action_update: false, action_delete: false },
            roles: { action_create: false, action_read: true, action_update: false, action_delete: false },
            dashboard: { action_access: true }
        }
    },
    'Guest': {
        name: 'Гость',
        description: 'Ограниченный доступ для внешних пользователей',
        rights: {
            courses: { action_create: false, action_read: true, action_read_own: false, action_update: false, action_update_own: false, action_delete: false, action_delete_own: false },
            users: { action_create: false, action_read: false, action_update: false, action_delete: false },
            usergroups: { action_create: false, action_read: false, action_update: false, action_delete: false },
            collections: { action_create: false, action_read: true, action_update: false, action_delete: false },
            organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
            coursechapters: { action_create: false, action_read: true, action_update: false, action_delete: false },
            activities: { action_create: false, action_read: true, action_update: false, action_delete: false },
            roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
            dashboard: { action_access: false }
        }
    }
}

const permissionLabels: Record<string, string> = {
    action_create: 'Создание',
    action_read: 'Просмотр',
    action_read_own: 'Просмотр своих',
    action_update: 'Редактирование',
    action_update_own: 'Редактирование своих',
    action_delete: 'Удаление',
    action_delete_own: 'Удаление своих',
    action_access: 'Доступ'
}

function AddRole(props: AddRoleProps) {
    const org = useOrg() as any;
    const session = useLHSession() as any
    const access_token = session?.data?.tokens?.access_token;
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [rights, setRights] = React.useState<Rights>(defaultRights)

    const formik = useFormik({
        initialValues: {
            name: '',
            description: '',
            org_id: org.id,
            rights: defaultRights
        },
        validate,
        onSubmit: async (values) => {
            const toastID = toast.loading("Создание...")
            setIsSubmitting(true)

            // Ensure rights object is properly structured
            const formattedRights = {
                courses: {
                    action_create: rights.courses?.action_create || false,
                    action_read: rights.courses?.action_read || false,
                    action_read_own: rights.courses?.action_read_own || false,
                    action_update: rights.courses?.action_update || false,
                    action_update_own: rights.courses?.action_update_own || false,
                    action_delete: rights.courses?.action_delete || false,
                    action_delete_own: rights.courses?.action_delete_own || false
                },
                users: {
                    action_create: rights.users?.action_create || false,
                    action_read: rights.users?.action_read || false,
                    action_update: rights.users?.action_update || false,
                    action_delete: rights.users?.action_delete || false
                },
                usergroups: {
                    action_create: rights.usergroups?.action_create || false,
                    action_read: rights.usergroups?.action_read || false,
                    action_update: rights.usergroups?.action_update || false,
                    action_delete: rights.usergroups?.action_delete || false
                },
                collections: {
                    action_create: rights.collections?.action_create || false,
                    action_read: rights.collections?.action_read || false,
                    action_update: rights.collections?.action_update || false,
                    action_delete: rights.collections?.action_delete || false
                },
                organizations: {
                    action_create: rights.organizations?.action_create || false,
                    action_read: rights.organizations?.action_read || false,
                    action_update: rights.organizations?.action_update || false,
                    action_delete: rights.organizations?.action_delete || false
                },
                coursechapters: {
                    action_create: rights.coursechapters?.action_create || false,
                    action_read: rights.coursechapters?.action_read || false,
                    action_update: rights.coursechapters?.action_update || false,
                    action_delete: rights.coursechapters?.action_delete || false
                },
                activities: {
                    action_create: rights.activities?.action_create || false,
                    action_read: rights.activities?.action_read || false,
                    action_update: rights.activities?.action_update || false,
                    action_delete: rights.activities?.action_delete || false
                },
                roles: {
                    action_create: rights.roles?.action_create || false,
                    action_read: rights.roles?.action_read || false,
                    action_update: rights.roles?.action_update || false,
                    action_delete: rights.roles?.action_delete || false
                },
                dashboard: {
                    action_access: rights.dashboard?.action_access || false
                }
            }

            const res = await createRole({
                name: values.name,
                description: values.description,
                org_id: values.org_id,
                rights: formattedRights
            }, access_token)
            if (res.status === 200 || res.status === 201) {
                setIsSubmitting(false)
                mutate(`${getAPIUrl()}roles/org/${org.id}`)
                props.setCreateRoleModal(false)
                toast.success("Новая роль создана", {id:toastID})
            } else {
                setIsSubmitting(false)
                toast.error("Не удалось создать новую роль", {id:toastID})
            }
        },
    })

    const handleRightChange = (section: keyof Rights, action: string, value: boolean) => {
        setRights(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [action]: value
            } as any
        }))
    }

    const handleSelectAll = (section: keyof Rights, value: boolean) => {
        setRights(prev => ({
            ...prev,
            [section]: Object.keys(prev[section]).reduce((acc, key) => ({
                ...acc,
                [key]: value
            }), {} as any)
        }))
    }

    const handlePredefinedRole = (roleKey: string) => {
        const role = predefinedRoles[roleKey as keyof typeof predefinedRoles]
        if (role) {
            formik.setFieldValue('name', role.name)
            formik.setFieldValue('description', role.description)
            setRights(role.rights as Rights)
        }
    }

    const PermissionSection = ({ title, icon: Icon, section, permissions }: { title: string, icon: any, section: keyof Rights, permissions: string[] }) => {
        const sectionRights = rights[section] as any
        const allSelected = permissions.every(perm => sectionRights[perm])
        const someSelected = permissions.some(perm => sectionRights[perm]) && !allSelected

        return (
            <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-white shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                    <div className="flex items-center space-x-2">
                        <Icon className="w-4 h-4 text-gray-500" />
                        <h3 className="font-semibold text-gray-800 text-sm sm:text-base">{title}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleSelectAll(section, !allSelected)}
                        className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700 font-medium self-start sm:self-auto transition-colors"
                    >
                        {allSelected ? <CheckSquare className="w-4 h-4" /> : someSelected ? <Square className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        <span className="hidden sm:inline">{allSelected ? 'Снять все' : 'Выбрать все'}</span>
                        <span className="sm:hidden">{allSelected ? 'Снять' : 'Выбрать'}</span>
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {permissions.map((permission) => (
                        <label key={permission} className="flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-gray-50 transition-colors">
                            <input
                                type="checkbox"
                                checked={rights[section]?.[permission as keyof typeof rights[typeof section]] || false}
                                onChange={(e) => handleRightChange(section, permission, e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                            />
                            <span className="text-sm text-gray-700 capitalize">
                                {permissionLabels[permission] || permission}
                            </span>
                        </label>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="py-3 max-w-6xl mx-auto px-2 sm:px-0">
            <FormLayout onSubmit={formik.handleSubmit}>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-4 sm:space-y-6">
                        <FormField name="name">
                            <FormLabelAndMessage label="Название роли" message={formik.errors.name} />
                            <Form.Control asChild>
                                <Input
                                    onChange={formik.handleChange}
                                    value={formik.values.name}
                                    type="text"
                                    required
                                    placeholder="например, Менеджер курсов"
                                    className="w-full"
                                />
                            </Form.Control>
                        </FormField>

                        <FormField name="description">
                            <FormLabelAndMessage label="Описание" message={formik.errors.description} />
                            <Form.Control asChild>
                                <Textarea
                                    onChange={formik.handleChange}
                                    value={formik.values.description}
                                    required
                                    placeholder="Опишите, что может делать эта роль..."
                                    className="w-full"
                                />
                            </Form.Control>
                        </FormField>

                        <div className="mt-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Предустановленные права</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Object.keys(predefinedRoles).map((roleKey) => (
                                    <button
                                        key={roleKey}
                                        type="button"
                                        onClick={() => handlePredefinedRole(roleKey)}
                                        className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-left bg-white shadow-sm hover:shadow-md"
                                    >
                                        <div className="font-medium text-gray-900 text-sm sm:text-base">{predefinedRoles[roleKey as keyof typeof predefinedRoles].name}</div>
                                        <div className="text-xs sm:text-sm text-gray-500 mt-1">{predefinedRoles[roleKey as keyof typeof predefinedRoles].description}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Разрешения</h3>

                        <PermissionSection
                            title="Курсы"
                            icon={BookOpen}
                            section="courses"
                            permissions={['action_create', 'action_read', 'action_read_own', 'action_update', 'action_update_own', 'action_delete', 'action_delete_own']}
                        />

                        <PermissionSection
                            title="Пользователи"
                            icon={Users}
                            section="users"
                            permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                        />

                        <PermissionSection
                            title="Группы пользователей"
                            icon={UserCheck}
                            section="usergroups"
                            permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                        />

                        <PermissionSection
                            title="Коллекции"
                            icon={FolderOpen}
                            section="collections"
                            permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                        />

                        <PermissionSection
                            title="Организации"
                            icon={Building}
                            section="organizations"
                            permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                        />

                        <PermissionSection
                            title="Главы курса"
                            icon={FileText}
                            section="coursechapters"
                            permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                        />

                        <PermissionSection
                            title="Активности"
                            icon={Activity}
                            section="activities"
                            permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                        />

                        <PermissionSection
                            title="Роли"
                            icon={Shield}
                            section="roles"
                            permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                        />

                        <PermissionSection
                            title="Панель управления"
                            icon={Monitor}
                            section="dashboard"
                            permissions={['action_access']}
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6 pt-6 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={() => props.setCreateRoleModal(false)}
                        className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors w-full sm:w-auto font-medium"
                    >
                        Отмена
                    </button>
                    <Form.Submit asChild>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 w-full sm:w-auto font-medium shadow-sm"
                        >
                            {isSubmitting ? 'Создание...' : 'Создать роль'}
                        </button>
                    </Form.Submit>
                </div>
            </FormLayout>
        </div>
    )
}

export default AddRole