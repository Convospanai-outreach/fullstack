import { vi } from 'vitest';

vi.mock('next/font/google', () => {
    const font = () => ({ className: '', variable: '', style: { fontFamily: '' } });
    return { Montserrat: font };
});
