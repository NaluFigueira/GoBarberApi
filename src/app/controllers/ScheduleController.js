import { Op } from 'sequelize';
import { startOfDay, endOfDay, parseISO } from 'date-fns';
import User from '../models/User';
import Appointment from '../models/Appointment';

class ScheduleController {
  async index(req, res) {
    const provider_id = req.userId;

    const provider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!provider)
      return res.status(401).json({ error: 'User is not a provider!' });

    const { date } = req.query;

    const parsedDate = parseISO(date);

    const appointments = await Appointment.findAll({
      where: {
        provider_id,
        date: {
          [Op.between]: [startOfDay(parsedDate), endOfDay(parsedDate)],
        },
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    return res.json(appointments);
  }
}

export default new ScheduleController();
