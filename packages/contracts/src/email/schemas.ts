import * as z from "zod";

const EmailAddressSchema = z.string().trim().email();

export const SendEmailInputSchema = z
  .object({
    to: z.union([
      EmailAddressSchema,
      z.array(EmailAddressSchema).min(1).max(50),
    ]),
    subject: z.string().trim().min(1).max(200),
    text: z.string().trim().min(1).max(20_000).optional(),
    html: z.string().trim().min(1).max(100_000).optional(),
    replyTo: EmailAddressSchema.optional(),
  })
  .refine((value) => value.text || value.html, {
    message: "Either text or html must be provided.",
    path: ["text"],
  });

export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;
