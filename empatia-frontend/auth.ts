import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || '72.60.89.5',
  user: process.env.POSTGRES_USER || 'empatia_admin',
  password: process.env.POSTGRES_PASSWORD || 'bigmoneycoming',
  database: process.env.POSTGRES_DB || 'empatia_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        // Caregivers log in with email; patients log in with username
        email: { label: 'Email', type: 'email' },
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        try {
          if (!credentials?.password) return null;

          const password = credentials.password as string;
          const email = credentials.email as string | undefined;
          const username = credentials.username as string | undefined;

          if (!email && !username) return null;

          const client = await pool.connect();
          try {
            let user;
            if (username) {
              // Patient login — by username
              const res = await client.query(
                'SELECT * FROM users WHERE username = $1',
                [username]
              );
              user = res.rows[0];
            } else {
              // Caregiver login — by email
              const res = await client.query(
                'SELECT * FROM users WHERE email = $1',
                [email]
              );
              user = res.rows[0];
            }

            if (!user) return null;

            const passwordsMatch = await bcrypt.compare(password, user.password);
            if (!passwordsMatch) return null;

            return {
              id: String(user.id),
              email: user.email,
              name: user.name,
            };
          } finally {
            client.release();
          }
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.AUTH_SECRET,
});
