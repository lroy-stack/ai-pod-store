'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckoutBreadcrumbProps {
  currentStep: 'cart' | 'shipping' | 'payment' | 'confirmation';
}

const STEPS = ['cart', 'shipping', 'payment', 'confirmation'] as const;

export default function CheckoutBreadcrumb({ currentStep }: CheckoutBreadcrumbProps) {
  const t = useTranslations('Checkout');

  const currentStepIndex = STEPS.indexOf(currentStep);

  return (
    <nav aria-label="Checkout progress" className="mb-8">
      <ol className="flex items-center justify-between md:justify-center md:space-x-8">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isActive = index === currentStepIndex;
          const isFuture = index > currentStepIndex;

          return (
            <li key={step} className="flex items-center">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full border-2 transition-colors',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isActive && 'border-primary bg-background text-primary',
                    isFuture && 'border-muted bg-background text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-5" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'mt-2 text-xs md:text-sm font-medium text-center',
                    isActive && 'text-foreground',
                    (isCompleted || isFuture) && 'text-muted-foreground'
                  )}
                >
                  {t(`breadcrumb.${step}`)}
                </span>
              </div>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'hidden md:block w-16 lg:w-24 h-0.5 mx-4 transition-colors',
                    index < currentStepIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
