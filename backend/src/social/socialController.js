import { socialService } from './socialService.js';
import { asyncWrap } from '../middleware/errorHandler.js';
import config from '../config/index.js';

export const getConnections = asyncWrap(async (req, res) => {
  const connections = socialService.getConnections(req.user.id);
  res.json({ connections });
});

export const instagramAuth = asyncWrap(async (req, res) => {
  const url = socialService.getInstagramAuthUrl(req.user.id);
  res.redirect(url);
});

export const instagramCallback = asyncWrap(async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code || !state) {
    return res.redirect(`${config.frontendUrl}/social?error=instagram_denied`);
  }
  try {
    await socialService.handleInstagramCallback({ code, state });
    res.redirect(`${config.frontendUrl}/social?connected=instagram`);
  } catch (err) {
    console.error('[social] Instagram callback error:', err.message);
    res.redirect(`${config.frontendUrl}/social?error=instagram_failed`);
  }
});

export const disconnectInstagram = asyncWrap(async (req, res) => {
  socialService.disconnectInstagram(req.user.id);
  res.json({ success: true });
});

export const linkedinAuth = asyncWrap(async (req, res) => {
  const url = socialService.getLinkedinAuthUrl(req.user.id);
  res.redirect(url);
});

export const linkedinCallback = asyncWrap(async (req, res) => {
  const { code, state, error } = req.query;
  if (error || !code || !state) {
    return res.redirect(`${config.frontendUrl}/social?error=linkedin_denied`);
  }
  try {
    await socialService.handleLinkedinCallback({ code, state });
    res.redirect(`${config.frontendUrl}/social?connected=linkedin`);
  } catch (err) {
    console.error('[social] LinkedIn callback error:', err.message);
    res.redirect(`${config.frontendUrl}/social?error=linkedin_failed`);
  }
});

export const disconnectLinkedin = asyncWrap(async (req, res) => {
  socialService.disconnectLinkedin(req.user.id);
  res.json({ success: true });
});
