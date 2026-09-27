import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
    },
    async (_accessToken: string, _refreshToken: string, profile: Profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || '';
        const name = profile.displayName;
        const avatar = profile.photos?.[0]?.value || '';
        const googleId = profile.id;

        // Upsert user
        const result = await pool.query(
          `INSERT INTO users (google_id, email, name, avatar)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (google_id) DO UPDATE
           SET email = EXCLUDED.email, name = EXCLUDED.name, avatar = EXCLUDED.avatar
           RETURNING *`,
          [googleId, email, name, avatar]
        );

        done(null, result.rows[0]);
      } catch (err) {
        done(err as Error);
      }
    }
  )
);

// Initiate Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// Google callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed` }),
  (req: Request, res: Response) => {
    const user = req.user as { id: string; email: string; name: string; avatar: string };
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await pool.query(
    'SELECT id, email, name, avatar, slack_token IS NOT NULL as slack_connected FROM users WHERE id = $1',
    [req.userId]
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(result.rows[0]);
});

router.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out' });
});

export default router;
