import jwt from 'jsonwebtoken';
import * as Yup from 'yup';
import User from '../models/User';
import File from '../models/File';
import auth from '../../config/auth';

class SessionController {
  async store(req, res) {
    const schema = Yup.object().shape({
      email: Yup.string()
        .email()
        .required(),
      password: Yup.string().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Invalid request fields!' });
    }
    const { email, password } = req.body;

    const userExists = await User.findOne({
      where: { email },
      include: [
        { model: File, as: 'avatar', attributes: ['id', 'path', 'url'] },
      ],
    });

    if (!userExists) res.status(401).json({ error: 'User not found' });

    if (!(await userExists.checkPassword(password)))
      res.status(401).json({ error: 'Password does not match' });

    const { id, name, avatar, provider } = userExists;

    return res.json({
      user: {
        id,
        name,
        email,
        avatar,
        provider,
      },
      token: jwt.sign({ id, name }, auth.secret, {
        expiresIn: auth.expires,
      }),
    });
  }
}

export default new SessionController();
