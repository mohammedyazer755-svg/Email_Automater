export const starterTemplates = [
  {
    name: 'Event Registration Confirmation',
    category: 'confirmation',
    subject: 'Your registration is confirmed',
    body_html:
      '<h1>You’re registered!</h1><p>Thank you for registering for our event. We look forward to welcoming you.</p><p>We will share the venue and schedule shortly.</p>',
  },
  {
    name: 'Event Reminder',
    category: 'reminder',
    subject: 'A reminder: our event is in two days',
    body_html:
      '<h1>See you soon</h1><p>Our event is just two days away. Please check your registration details and arrive a few minutes early.</p>',
  },
  {
    name: 'Team Selection Announcement',
    category: 'announcement',
    subject: 'Welcome to the team',
    body_html:
      '<h1>Congratulations!</h1><p>You have been selected to join our team. We will be in touch with the next steps.</p>',
  },
  {
    name: 'Payment Confirmation',
    category: 'confirmation',
    subject: 'We have received your payment',
    body_html:
      '<h1>Payment received</h1><p>Thank you. Your payment has been received. Please keep your receipt for your records.</p>',
  },
  {
    name: 'Certificate Distribution',
    category: 'certificate',
    subject: 'Your certificate is ready',
    body_html:
      '<h1>Well done!</h1><p>Thank you for participating. Your certificate is attached to this email.</p>',
  },
] as const;
