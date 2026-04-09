import { toast as sonnerToast } from 'sonner';

type ToastProps = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
};

function toast({ title, description, variant = 'default' }: ToastProps) {
  const message = description || title || '';
  
  if (variant === 'destructive') {
    sonnerToast.error(message, {
      description: title && description ? title : undefined,
      duration: 4000,
    });
  } else {
    sonnerToast.success(message, {
      description: title && description ? title : undefined,
      duration: 3000,
    });
  }

  return {
    id: Math.random().toString(),
    dismiss: () => sonnerToast.dismiss(),
    update: (props: ToastProps) => toast(props),
  };
}

function useToast() {
  return {
    toasts: [],
    toast,
    dismiss: () => sonnerToast.dismiss(),
  };
}

export { useToast, toast };
