'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface Question {
  question: string
  answer: string
}

interface FAQAccordionProps {
  questions: Question[]
}

export function FAQAccordion({ questions }: FAQAccordionProps) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {questions.map((item, idx) => (
        <AccordionItem key={idx} value={`item-${idx}`}>
          <AccordionTrigger className="px-6 text-left">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4 text-muted-foreground">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
