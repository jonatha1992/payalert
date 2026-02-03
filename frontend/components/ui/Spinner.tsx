import { Loader2 } from 'lucide-react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
    return (
        <Loader2 className={`animate-spin text-blue-500 ${sizes[size]} ${className}`} />
    );
}

export function PageLoader() {
    return (
        <div className="min-h-[400px] flex items-center justify-center">
            <Spinner size="xl" />
        </div>
    );
}
