import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Clear existing data
  await prisma.payment.deleteMany();
  await prisma.verificationDocument.deleteMany();
  await prisma.checkIn.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.messageThread.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.clientProfile.deleteMany();
  await prisma.companionProfile.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data');

  // Create Admin
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@plusone.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      subscriptionTier: 'PREMIUM',
    },
  });
  console.log('Created admin:', admin.email);

  // Create Companions with new fields
  const companionData = [
    {
      email: 'priya@plusone.com',
      name: 'Priya Sharma',
      bio: 'Elegant and sophisticated companion with a passion for art galleries and fine dining. Fluent in English and Hindi.',
      hourlyRate: 250000,
      lat: 28.6129,
      lng: 77.2295,
      avatarUrl: 'https://i.pravatar.cc/300?img=1',
      gender: 'Female',
      age: 28,
      languages: ['English', 'Hindi'],
      interests: ['Art', 'Fine Dining', 'Travel', 'Photography'],
      isVerified: true,
      verificationStatus: 'APPROVED',
    },
    {
      email: 'ananya@plusone.com',
      name: 'Ananya Patel',
      bio: 'Fun-loving and adventurous spirit. Enjoys hiking, dancing, and exploring hidden gems in the city.',
      hourlyRate: 200000,
      lat: 28.6356,
      lng: 77.2011,
      avatarUrl: 'https://i.pravatar.cc/300?img=5',
      gender: 'Female',
      age: 25,
      languages: ['English', 'Hindi', 'Gujarati'],
      interests: ['Hiking', 'Dancing', 'Exploring', 'Music'],
      isVerified: true,
      verificationStatus: 'APPROVED',
    },
    {
      email: 'vikram@plusone.com',
      name: 'Vikram Singh',
      bio: 'Charming and well-read companion. Perfect for business events and intellectual conversations.',
      hourlyRate: 300000,
      lat: 28.5921,
      lng: 77.2256,
      avatarUrl: 'https://i.pravatar.cc/300?img=12',
      gender: 'Male',
      age: 32,
      languages: ['English', 'Hindi', 'Punjabi'],
      interests: ['Business', 'Literature', 'Golf', 'Wine Tasting'],
      isVerified: true,
      verificationStatus: 'APPROVED',
    },
  ];

  const companions: { id: string; email: string; name: string }[] = [];

  for (const data of companionData) {
    const password = await bcrypt.hash('companion123', 10);
    const availability = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return date.toISOString().split('T')[0];
    });

    const companion = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: password,
        role: 'COMPANION',
        isActive: true,
        subscriptionTier: 'FREE',
        companionProfile: {
          create: {
            name: data.name,
            bio: data.bio,
            hourlyRate: data.hourlyRate,
            lat: data.lat,
            lng: data.lng,
            avatarUrl: data.avatarUrl,
            isApproved: true,
            isVerified: data.isVerified,
            availability: JSON.stringify(availability),
            images: JSON.stringify([data.avatarUrl]),
            gender: data.gender,
            age: data.age,
            languages: JSON.stringify(data.languages),
            interests: JSON.stringify(data.interests),
            verificationStatus: data.verificationStatus,
          },
        },
      },
    });

    companions.push({ id: companion.id, email: companion.email, name: data.name });
    console.log('Created companion:', companion.email);
  }

  // Create Clients with emergency contacts
  const client1Password = await bcrypt.hash('client123', 10);
  const client1 = await prisma.user.create({
    data: {
      email: 'client1@test.com',
      passwordHash: client1Password,
      role: 'CLIENT',
      subscriptionTier: 'FREE',
      clientProfile: {
        create: {
          name: 'Rahul Verma',
          bio: 'Business professional looking for good company.',
          lat: 28.6139,
          lng: 77.2090,
          avatarUrl: 'https://i.pravatar.cc/300?img=8',
          phone: '+91 98765 43210',
        },
      },
      emergencyContact: {
        create: {
          name: 'Sunita Verma',
          phone: '+91 98765 43211',
          relationship: 'Sister',
        },
      },
    },
  });
  console.log('Created client (FREE):', client1.email);

  const client2Password = await bcrypt.hash('client123', 10);
  const client2 = await prisma.user.create({
    data: {
      email: 'client2@test.com',
      passwordHash: client2Password,
      role: 'CLIENT',
      subscriptionTier: 'PREMIUM',
      clientProfile: {
        create: {
          name: 'Amit Kumar',
          bio: 'Premium member who enjoys fine dining and cultural events.',
          lat: 28.6229,
          lng: 77.2190,
          avatarUrl: 'https://i.pravatar.cc/300?img=11',
          phone: '+91 98765 43220',
        },
      },
      emergencyContact: {
        create: {
          name: 'Rajesh Kumar',
          phone: '+91 98765 43221',
          relationship: 'Brother',
        },
      },
    },
  });
  console.log('Created client (PREMIUM):', client2.email);

  // Create sample bookings
  const bookings = [
    {
      clientId: client1.id,
      companionId: companions[0].id,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      duration: 3,
      status: 'PENDING',
      totalAmount: 750000,
      depositAmount: 150000,
      notes: 'Would like to discuss art over coffee.',
      location: 'Cafe Coffee Day, Connaught Place',
    },
    {
      clientId: client1.id,
      companionId: companions[1].id,
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      duration: 2,
      status: 'CONFIRMED',
      totalAmount: 400000,
      depositAmount: 80000,
      notes: 'Dinner date at Italian restaurant.',
      location: 'Olive Bar & Kitchen, Mehrauli',
    },
    {
      clientId: client2.id,
      companionId: companions[2].id,
      date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      duration: 4,
      status: 'CONFIRMED',
      totalAmount: 1200000,
      depositAmount: 240000,
      notes: 'Business event companion needed.',
      location: 'Hyatt Regency, Bhikaji Cama Place',
    },
    {
      clientId: client2.id,
      companionId: companions[0].id,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      duration: 2,
      status: 'COMPLETED',
      totalAmount: 500000,
      depositAmount: 100000,
      paymentStatus: 'PAID',
      notes: 'Gallery opening.',
      location: 'National Gallery of Modern Art',
    },
    {
      clientId: client2.id,
      companionId: companions[1].id,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      duration: 3,
      status: 'PENDING',
      totalAmount: 600000,
      depositAmount: 120000,
      notes: 'Weekend outing.',
      location: 'Lodhi Garden',
    },
  ];

  const createdBookings = [];
  for (const booking of bookings) {
    const created = await prisma.booking.create({
      data: booking,
    });
    createdBookings.push(created);
  }
  console.log('Created 5 sample bookings');

  // Create sample review for completed booking
  await prisma.review.create({
    data: {
      bookingId: createdBookings[3].id,
      reviewerId: client2.id,
      reviewedId: companions[0].id,
      rating: 5,
      comment: 'Wonderful company! Priya was elegant and knowledgeable about art. Made the gallery visit truly enjoyable.',
      isPublic: true,
    },
  });
  console.log('Created sample review');

  // Update companion average rating
  await prisma.companionProfile.update({
    where: { userId: companions[0].id },
    data: { averageRating: 5, reviewCount: 1 },
  });

  // Create sample message threads
  const thread1 = await prisma.messageThread.create({
    data: {
      clientId: client1.id,
      companionId: companions[0].id,
      messageCount: 7,
      isLocked: false,
    },
  });

  const messages1 = [
    { content: 'Hi! I am interested in booking you.', senderId: client1.id, receiverId: companions[0].id },
    { content: 'Hello! I would be happy to help.', senderId: companions[0].id, receiverId: client1.id },
    { content: 'Are you available next weekend?', senderId: client1.id, receiverId: companions[0].id },
    { content: 'Yes, I am free on Saturday evening.', senderId: companions[0].id, receiverId: client1.id },
    { content: 'Great! What time works for you?', senderId: client1.id, receiverId: companions[0].id },
    { content: 'I am available after 6 PM.', senderId: companions[0].id, receiverId: client1.id },
    { content: 'Perfect, I will make the booking now.', senderId: client1.id, receiverId: companions[0].id },
  ];

  for (const msg of messages1) {
    await prisma.message.create({
      data: {
        threadId: thread1.id,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        content: msg.content,
      },
    });
  }
  console.log('Created thread with 7 messages (1 away from limit)');

  // Create favorites for client1
  await prisma.favorite.create({
    data: {
      clientId: client1.id,
      companionId: companions[0].id,
    },
  });
  await prisma.favorite.create({
    data: {
      clientId: client1.id,
      companionId: companions[1].id,
    },
  });
  console.log('Created 2 favorites for client1');

  // Create sample notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: client1.id,
        type: 'BOOKING',
        title: 'Booking Requested',
        message: 'Your booking with Priya Sharma has been requested.',
        isRead: true,
      },
      {
        userId: client2.id,
        type: 'MESSAGE',
        title: 'New Message',
        message: 'You have a new message from Vikram Singh.',
        isRead: false,
      },
      {
        userId: companions[0].id,
        type: 'BOOKING',
        title: 'New Booking',
        message: 'Amit Kumar has booked you for an event.',
        isRead: false,
      },
    ],
  });
  console.log('Created sample notifications');

  // Create additional companions to test 20 limit
  const interests = ['Travel', 'Food', 'Movies', 'Sports', 'Music', 'Reading', 'Fitness', 'Photography'];
  const languages = ['English', 'Hindi', 'Tamil', 'Telugu', 'Bengali', 'Marathi'];

  for (let i = 0; i < 17; i++) {
    const password = await bcrypt.hash('companion123', 10);
    const randomInterests = interests.sort(() => 0.5 - Math.random()).slice(0, 3);
    const randomLanguages = languages.sort(() => 0.5 - Math.random()).slice(0, 2);

    await prisma.user.create({
      data: {
        email: `companion${i + 4}@plusone.com`,
        passwordHash: password,
        role: 'COMPANION',
        isActive: true,
        companionProfile: {
          create: {
            name: `Companion ${i + 4}`,
            bio: 'A wonderful companion for any occasion.',
            hourlyRate: 200000 + Math.floor(Math.random() * 200000),
            lat: 28.5 + Math.random() * 0.3,
            lng: 77.1 + Math.random() * 0.3,
            isApproved: true,
            availability: '[]',
            gender: i % 2 === 0 ? 'Female' : 'Male',
            age: 24 + Math.floor(Math.random() * 10),
            languages: JSON.stringify(randomLanguages),
            interests: JSON.stringify(randomInterests),
          },
        },
      },
    });
  }
  console.log('Created 17 additional companions for testing the 20 limit');

  console.log('\n=== Seed completed successfully ===');
  console.log('\nTest accounts:');
  console.log('Admin: admin@plusone.com / admin123');
  console.log('Client (FREE): client1@test.com / client123');
  console.log('Client (PREMIUM): client2@test.com / client123');
  console.log('All Companions: companion123');
  console.log('\nCompanion emails:', companions.map(c => c.email).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
