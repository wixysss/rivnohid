type NavLink = {
    to: string;
    label: string;
};

export const NAV_LINKS: NavLink[] = [
    {to: '/map', label: 'Карта'},
    {to: '/map/editor', label: 'Редактор'},
    {to: '/route', label: 'Навігатор'},
    {to: '/live', label: 'Наживо'},
]
