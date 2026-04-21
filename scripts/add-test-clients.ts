import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

const clients = [
  { name: 'Arjun Mehta',      email: 'arjun.mehta92@gmail.com',      phone: '9812345601', dob: '1992-03-14', password: 'Arjun@2024'    },
  { name: 'Priya Sharma',     email: 'priya.sharma88@outlook.com',   phone: '9823456702', dob: '1988-07-22', password: 'Priya@2024'    },
  { name: 'Rahul Verma',      email: 'rahul.verma95@gmail.com',      phone: '9834567803', dob: '1995-11-05', password: 'Rahul@2024'    },
  { name: 'Sneha Kapoor',     email: 'sneha.kapoor90@yahoo.com',     phone: '9845678904', dob: '1990-01-30', password: 'Sneha@2024'    },
  { name: 'Vikram Nair',      email: 'vikram.nair87@gmail.com',      phone: '9856789005', dob: '1987-09-18', password: 'Vikram@2024'   },
  { name: 'Ananya Bose',      email: 'ananya.bose93@hotmail.com',    phone: '9867890106', dob: '1993-05-27', password: 'Ananya@2024'   },
  { name: 'Rohan Malhotra',   email: 'rohan.malhotra91@gmail.com',   phone: '9878901207', dob: '1991-12-09', password: 'Rohan@2024'    },
  { name: 'Kavya Reddy',      email: 'kavya.reddy96@outlook.com',    phone: '9889012308', dob: '1996-08-03', password: 'Kavya@2024'    },
  { name: 'Aditya Joshi',     email: 'aditya.joshi89@gmail.com',     phone: '9890123409', dob: '1989-04-16', password: 'Aditya@2024'   },
  { name: 'Ishaan Gupta',     email: 'ishaan.gupta94@gmail.com',     phone: '9801234510', dob: '1994-02-21', password: 'Ishaan@2024'   },
];

async function main() {
  console.log('Creating 10 test clients...\n');

  for (const c of clients) {
    const existing = await prisma.user.findUnique({ where: { email: c.email } });
    if (existing) {
      console.log(`SKIP  ${c.email} — already exists`);
      continue;
    }

    const passwordHash = await bcrypt.hash(c.password, 10);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: c.email,
          passwordHash,
          role: 'CLIENT',
          clientStatus: 'APPROVED',
          phone: c.phone,
          linkedInUrl: `https://linkedin.com/in/${c.name.toLowerCase().replace(' ', '-')}`,
          clientProfile: {
            create: {
              name: c.name,
              dateOfBirth: new Date(c.dob),
              bio: '',
              lat: 28.6139,
              lng: 77.209,
            },
          },
        },
      });

      await tx.wallet.create({
        data: { userId: user.id, balance: 0 },
      });
    });

    console.log(`OK    ${c.name.padEnd(18)} ${c.email.padEnd(35)} ${c.password}`);
  }

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
