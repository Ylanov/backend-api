export const initialData = {
  activities: {
    'activity-1': { id: 'activity-1', content: 'Первое занятие' },
    'activity-2': { id: 'activity-2', content: 'Второе занятие' },
    'activity-3': { id: 'activity-3', content: 'Третье занятие' },
    'activity-4': { id: 'activity-4', content: 'Четвертое занятие' },
    'activity-5': { id: 'activity-5', content: 'Пятое занятие' },
  },
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      name: 'Глава 1',
      activityIds: ['activity-1', 'activity-2', 'activity-3'],
    },
    'chapter-2': {
      id: 'chapter-2',
      name: 'Глава 2',
      activityIds: ['activity-4'],
    },
    'chapter-3': {
      id: 'chapter-3',
      name: 'Глава 3',
      activityIds: ['activity-5'],
    },
  },

  chapterOrder: ['chapter-1', 'chapter-2', 'chapter-3'],
}

export const initialData2 = {}