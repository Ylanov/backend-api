import styled from 'styled-components'
import {
  FontBoldIcon,
  FontItalicIcon,
  StrikethroughIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  DividerVerticalIcon,
  ListBulletIcon,
  TableIcon,
  RowsIcon,
  ColumnsIcon,
  SectionIcon,
  ContainerIcon,
  ChevronDownIcon,
} from '@radix-ui/react-icons'
import {
  AlertCircle,
  AlertTriangle,
  BadgeHelp,
  Code,
  Cuboid,
  FileText,
  ImagePlus,
  Link2,
  MousePointerClick,
  RotateCw,
  Sigma,
  Tags,
  User,
  Video,
  List,
  ListOrdered,
  Globe,
  GitBranch,
} from 'lucide-react'
import { SiYoutube } from '@icons-pack/react-simple-icons'
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import React from 'react'
import LinkInputTooltip from './LinkInputTooltip'

export const ToolbarButtons = ({ editor, props }: any) => {
  const [showTableMenu, setShowTableMenu] = React.useState(false)
  const [showListMenu, setShowListMenu] = React.useState(false)
  const [showLinkInput, setShowLinkInput] = React.useState(false)
  const linkButtonRef = React.useRef<HTMLDivElement>(null)

  if (!editor) {
    return null
  }


  const tableOptions = [
    {
      label: 'Вставить таблицу (3×3)',
      icon: <TableIcon />,
      action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    },
    {
      label: 'Добавить строку ниже',
      icon: <RowsIcon />,
      action: () => editor.chain().focus().addRowAfter().run()
    },
    {
      label: 'Добавить столбец справа',
      icon: <ColumnsIcon />,
      action: () => editor.chain().focus().addColumnAfter().run()
    },
    {
      label: 'Удалить текущую строку',
      icon: <SectionIcon />,
      action: () => editor.chain().focus().deleteRow().run()
    },
    {
      label: 'Удалить текущий столбец',
      icon: <ContainerIcon />,
      action: () => editor.chain().focus().deleteColumn().run()
    }
  ]

  const listOptions = [
    {
      label: 'Маркированный список',
      icon: <List size={15} />,
      action: () => {
        if (editor.isActive('bulletList')) {
          editor.chain().focus().toggleBulletList().run()
        } else {
          editor.chain().focus().toggleOrderedList().run()
          editor.chain().focus().toggleBulletList().run()
        }
      }
    },
    {
      label: 'Нумерованный список',
      icon: <ListOrdered size={15} />,
      action: () => {
        if (editor.isActive('orderedList')) {
          editor.chain().focus().toggleOrderedList().run()
        } else {
          editor.chain().focus().toggleBulletList().run()
          editor.chain().focus().toggleOrderedList().run()
        }
      }
    }
  ]

  const handleLinkClick = () => {
    // Store the current selection
    const { from, to } = editor.state.selection

    if (editor.isActive('link')) {
      const currentLink = editor.getAttributes('link')
      setShowLinkInput(true)
    } else {
      setShowLinkInput(true)
    }

    // Restore the selection after a small delay to ensure the tooltip is rendered
    setTimeout(() => {
      editor.commands.setTextSelection({ from, to })
    }, 0)
  }

  const getCurrentLinkUrl = () => {
    if (editor.isActive('link')) {
      return editor.getAttributes('link').href
    }
    return ''
  }

  const handleLinkSave = (url: string) => {
    editor
      .chain()
      .focus()
      .setLink({
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer'
      })
      .run()
    setShowLinkInput(false)
  }

  const handleLinkCancel = () => {
    setShowLinkInput(false)
  }

  return (
    <ToolButtonsWrapper>
      <ToolBtn onClick={() => editor.chain().focus().undo().run()} aria-label="Отменить последнее действие">
        <ArrowLeftIcon />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} aria-label="Повторить последнее действие">
        <ArrowRightIcon />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'is-active' : ''}
        aria-label="Жирный шрифт"
      >
        <FontBoldIcon />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'is-active' : ''}
        aria-label="Курсив"
      >
        <FontItalicIcon />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={editor.isActive('strike') ? 'is-active' : ''}
        aria-label="Зачеркнутый"
      >
        <StrikethroughIcon />
      </ToolBtn>
      <ListMenuWrapper>
        <ToolBtn
          onClick={() => setShowListMenu(!showListMenu)}
          className={showListMenu || editor.isActive('bulletList') || editor.isActive('orderedList') ? 'is-active' : ''}
          aria-label="Вставить список"
        >
          <ListBulletIcon />
          <ChevronDownIcon />
        </ToolBtn>
        {showListMenu && (
          <ListDropdown>
            {listOptions.map((option, index) => (
              <ListMenuItem
                key={index}
                onClick={() => {
                  option.action()
                  setShowListMenu(false)
                }}
                className={editor.isActive(option.label === 'Маркированный список' ? 'bulletList' : 'orderedList') ? 'is-active' : ''}
              >
                <span className="icon">{option.icon}</span>
                <span className="label">{option.label}</span>
              </ListMenuItem>
            ))}
          </ListDropdown>
        )}
      </ListMenuWrapper>
      <ToolSelect
        value={
          editor.isActive('heading', { level: 1 }) ? "1" :
          editor.isActive('heading', { level: 2 }) ? "2" :
          editor.isActive('heading', { level: 3 }) ? "3" :
          editor.isActive('heading', { level: 4 }) ? "4" :
          editor.isActive('heading', { level: 5 }) ? "5" :
          editor.isActive('heading', { level: 6 }) ? "6" : "0"
        }
        onChange={(e) => {
          const value = e.target.value;
          if (value === "0") {
            editor.chain().focus().setParagraph().run();
          } else {
            editor.chain().focus().toggleHeading({ level: parseInt(value) }).run();
          }
        }}
      >
        <option value="0">Параграф</option>
        <option value="1">Заголовок 1</option>
        <option value="2">Заголовок 2</option>
        <option value="3">Заголовок 3</option>
        <option value="4">Заголовок 4</option>
        <option value="5">Заголовок 5</option>
        <option value="6">Заголовок 6</option>
      </ToolSelect>
      <TableMenuWrapper>
        <ToolBtn
          onClick={() => setShowTableMenu(!showTableMenu)}
          className={showTableMenu ? 'is-active' : ''}
          aria-label="Вставить таблицу"
        >
          <TableIcon width={18} />
          <ChevronDownIcon  />
        </ToolBtn>
        {showTableMenu && (
          <TableDropdown>
            {tableOptions.map((option, index) => (
              <TableMenuItem
                key={index}
                onClick={() => {
                  option.action()
                  setShowTableMenu(false)
                }}
              >
                <span className="icon">{option.icon}</span>
                <span className="label">{option.label}</span>
              </TableMenuItem>
            ))}
          </TableDropdown>
        )}
      </TableMenuWrapper>
      <DividerVerticalIcon
        style={{ marginTop: 'auto', marginBottom: 'auto', color: 'grey' }}
      />
      <ToolTip content={'Инфо-блок'}>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleNode('calloutInfo').run()}
          aria-label="Вставить информационный блок"
        >
          <AlertCircle size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Предупреждение'}>
        <ToolBtn
          onClick={() =>
            editor.chain().focus().toggleNode('calloutWarning').run()
          }
          aria-label="Вставить предупреждающий блок"
        >
          <AlertTriangle size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Ссылка'}>
        <div style={{ position: 'relative' }}>
          <ToolBtn
            ref={linkButtonRef}
            onClick={handleLinkClick}
            className={editor.isActive('link') ? 'is-active' : ''}
            aria-label="Вставить или изменить ссылку"
          >
            <Link2 size={15} />
          </ToolBtn>
          {showLinkInput && (
            <LinkInputTooltip
              onSave={handleLinkSave}
              onCancel={handleLinkCancel}
              currentUrl={getCurrentLinkUrl()}
            />
          )}
        </div>
      </ToolTip>
      <ToolTip content={'Изображение'}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockImage',
              })
              .run()
          }
          aria-label="Вставить изображение"
        >
          <ImagePlus size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Видео'}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockVideo',
              })
              .run()
          }
          aria-label="Вставить видео"
        >
          <Video size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'YouTube видео'}>
        <ToolBtn onClick={() => editor.chain().focus().insertContent({ type: 'blockEmbed' }).run()} aria-label="Вставить видео с YouTube">
          <SiYoutube size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Математическая формула (LaTeX)'}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockMathEquation',
              })
              .run()
          }
          aria-label="Вставить формулу (LaTeX)"
        >
          <Sigma size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'PDF документ'}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockPDF',
              })
              .run()
          }
          aria-label="Вставить PDF документ"
        >
          <FileText size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Интерактивный квиз'}>
        <ToolBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'blockQuiz',
              })
              .run()
          }
          aria-label="Вставить интерактивный квиз"
        >
          <BadgeHelp size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Блок кода'}>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'is-active' : ''}
          aria-label="Вставить блок кода"
        >
          <Code size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Внешний объект (Embed)'}>
        <ToolBtn
          onClick={() => editor.chain().focus().insertContent({ type: 'blockEmbed' }).run()}
          aria-label="Вставить внешний объект (Embed)"
        >
          <Cuboid size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Бейджи'}>
        <ToolBtn
          onClick={() => editor.chain().focus().insertContent({
            type: 'badge',
            content: [
              {
                type: 'text',
                text: 'Это бейдж'
              }
            ]
          }).run()}
          aria-label="Вставить бейдж"
        >
          <Tags size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Кнопка'}>
        <ToolBtn
          onClick={() => editor.chain().focus().insertContent({
            type: 'button',
            content: [
              {
                type: 'text',
                text: 'Нажми меня'
              }
            ]
          }).run()}
          aria-label="Вставить кнопку"
        >
          <MousePointerClick size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Пользователь'}>
        <ToolBtn
          onClick={() => editor.chain().focus().insertContent({ type: 'blockUser' }).run()}
          aria-label="Упомянуть пользователя"
        >
          <User size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Веб-превью'}>
        <ToolBtn
          onClick={() =>
            editor.chain().focus().insertContent({
              type: 'blockWebPreview',
            }).run()
          }
          aria-label="Вставить предпросмотр веб-страницы"
        >
          <Globe size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Флип-карта'}>
        <ToolBtn
          onClick={() =>
            editor.chain().focus().insertContent({
              type: 'flipcard',
              attrs: {
                question: 'Нажмите, чтобы увидеть ответ',
                answer: 'Это ответ',
                color: 'blue',
                alignment: 'center',
                size: 'medium'
              }
            }).run()
          }
          aria-label="Вставить флип-карту"
        >
          <RotateCw size={15} />
        </ToolBtn>
      </ToolTip>
      <ToolTip content={'Интерактивные сценарии'}>
        <ToolBtn
          onClick={() =>
            editor.chain().focus().insertContent({
              type: 'scenarios',
              attrs: {
                title: 'Интерактивный сценарий',
                scenarios: [
                  {
                    id: '1',
                    text: 'Добро пожаловать в интерактивный сценарий. Что бы вы хотели сделать?',
                    imageUrl: '',
                    options: [
                      { id: 'opt1', text: 'Продолжить изучение', nextScenarioId: '2' },
                      { id: 'opt2', text: 'Узнать больше о теме', nextScenarioId: '3' }
                    ]
                  },
                  {
                    id: '2',
                    text: 'Отличный выбор! Вы продвинулись дальше. Каков ваш следующий шаг?',
                    imageUrl: '',
                    options: [
                      { id: 'opt3', text: 'Вернуться в начало', nextScenarioId: '1' },
                      { id: 'opt4', text: 'Завершить сценарий', nextScenarioId: null }
                    ]
                  },
                  {
                    id: '3',
                    text: 'Вот дополнительная информация по теме. Это поможет вам лучше разобраться.',
                    imageUrl: '',
                    options: [
                      { id: 'opt5', text: 'Вернуться в начало', nextScenarioId: '1' },
                      { id: 'opt6', text: 'Завершить сценарий', nextScenarioId: null }
                    ]
                  }
                ],
                currentScenarioId: '1'
              }
            }).run()
          }
          aria-label="Вставить интерактивный сценарий"
        >
          <GitBranch size={15} />
        </ToolBtn>
      </ToolTip>
    </ToolButtonsWrapper>
  )
}

const ToolButtonsWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: left;
  justify-content: left;
`

const ToolBtn = styled.div`
  display: flex;
  background: rgba(217, 217, 217, 0.24);
  border-radius: 6px;
  min-width: 25px;
  height: 25px;
  padding: 5px;
  margin-right: 5px;
  transition: all 0.2s ease-in-out;

  svg {
    padding: 1px;
  }

  &.is-active {
    background: rgba(176, 176, 176, 0.5);

    &:hover {
      background: rgba(139, 139, 139, 0.5);
      cursor: pointer;
    }
  }

  &:hover {
    background: rgba(217, 217, 217, 0.48);
    cursor: pointer;
  }
`

const ToolSelect = styled.select`
  display: flex;
  background: rgba(217, 217, 217, 0.185);
  border-radius: 6px;
  width: 120px;
  border: none;
  height: 25px;
  padding: 2px 5px;
  font-size: 11px;
  font-family: 'DM Sans';
  margin-right: 5px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 5px center;
  background-size: 12px;
  padding-right: 20px;

  &:hover {
    background-color: rgba(217, 217, 217, 0.3);
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(217, 217, 217, 0.5);
  }
`

const TableMenuWrapper = styled.div`
  position: relative;
  display: inline-block;
`

const TableDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid rgba(217, 217, 217, 0.5);
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  min-width: 180px;
  margin-top: 4px;
`

const TableMenuItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(217, 217, 217, 0.24);
  }

  .icon {
    margin-right: 8px;
    display: flex;
    align-items: center;
  }

  .label {
    font-size: 12px;
    font-family: 'DM Sans';
  }
`

const ListMenuWrapper = styled.div`
  position: relative;
  display: inline-block;
`

const ListDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid rgba(217, 217, 217, 0.5);
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  min-width: 180px;
  margin-top: 4px;
`

const ListMenuItem = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: rgba(217, 217, 217, 0.24);
  }

  &.is-active {
    background: rgba(176, 176, 176, 0.5);
  }

  .icon {
    margin-right: 8px;
    display: flex;
    align-items: center;
  }

  .label {
    font-size: 12px;
    font-family: 'DM Sans';
  }
`