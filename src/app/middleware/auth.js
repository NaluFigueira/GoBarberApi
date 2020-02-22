import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import auth from '../../config/auth';

export default async (req, res, next) => {
  const { authorization } = req.headers;

  console.log(authorization);

  if (!authorization) return res.status(401).json('User not authorized!');

  const [, token] = authorization.split(' ');

  try {
    const decoded = await promisify(jwt.verify)(token, auth.secret);

    req.userId = decoded.id;

    return next();
  } catch (error) {
    return res.status(401).json('Invalid token!');
  }
};
