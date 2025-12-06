'use client'
import FormLayout, {
    FormField,
    FormLabelAndMessage,
    Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { useOrg } from '@components/Contexts/OrgContext'
import React from 'react'
import { createUserGroup } from '@services/usergroups/usergroups'
import { mutate } from 'swr'
import { getAPIUrl } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useFormik } from 'formik'
import toast from 'react-hot-toast'

type AddUserGroupProps = {
    setCreateUserGroupModal: any
}
const validate = (values: any) => {
    const errors: any = {}

    if (!values.name) {
        errors.name = 'Название обязательно'
    }

    return errors
}

function AddUserGroup(props: AddUserGroupProps) {
    const org = useOrg() as any;
    const session = useLHSession() as any
    const access_token = session?.data?.tokens?.access_token;
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const formik = useFormik({
        initialValues: {
            name: '',
            description: '',
            org_id: org.id
        },
        validate,
        onSubmit: async (values) => {
            const toastID = toast.loading("Создание...")
            setIsSubmitting(true)
            const res = await createUserGroup(values, access_token)
            if (res.status == 200) {
                setIsSubmitting(false)
                mutate(`${getAPIUrl()}usergroups/org/${org.id}`)
                props.setCreateUserGroupModal(false)
                toast.success("Создана новая группа пользователей", {id:toastID})
            } else {
                setIsSubmitting(false)
                toast.error("Не удалось создать группу пользователей", {id:toastID})
            }
        },
    })

    return (
        <FormLayout onSubmit={formik.handleSubmit}>
            <FormField name="name">
                <FormLabelAndMessage
                    label="Название"
                    message={formik.errors.name}
                />
                <Form.Control asChild>
                    <Input
                        onChange={formik.handleChange}
                        value={formik.values.name}
                        type="name"
                        required
                    />
                </Form.Control>
            </FormField>
            <FormField name="description">
                <FormLabelAndMessage
                    label="Описание"
                    message={formik.errors.description}
                />
                <Form.Control asChild>
                    <Input
                        onChange={formik.handleChange}
                        value={formik.values.description}
                        type="description"
                    />
                </Form.Control>
            </FormField>
            <div className="flex py-4">
                <Form.Submit asChild>
                    <button className="w-full bg-black text-white font-bold text-center p-2 rounded-md shadow-md hover:cursor-pointer">
                        {isSubmitting ? 'Загрузка...' : 'Создать UserGroup'}
                    </button>
                </Form.Submit>
            </div>
        </FormLayout>
    )
}

export default AddUserGroup
