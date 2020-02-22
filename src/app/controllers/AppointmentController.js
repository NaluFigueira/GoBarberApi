import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';
import Notification from '../schemas/NotificationSchema';

import Queue from '../../lib/Queue';
import CancellationMail from '../jobs/CancellationMail';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;
    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      attributes: ['id', 'date', 'past', 'cancelable', 'canceled_at'],
      order: ['date'],
      limit: 20,
      offset: (page - 1) * 20,
      include: {
        model: User,
        as: 'provider',
        attributes: ['id', 'name'],
        include: {
          model: File,
          as: 'avatar',
          attributes: ['url', 'id', 'path'],
        },
      },
    });

    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      date: Yup.date().required(),
      provider_id: Yup.number().required(),
    });
    if (!(await schema.isValid(req.body)))
      return res.status(400).json({ error: 'Invalid data!' });

    const { provider_id, date } = req.body;

    const provider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!provider) {
      return res
        .status(401)
        .json({ error: 'A valid provider id is required!' });
    }

    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date()))
      return res.status(401).json({ error: 'Invalid appointment date!' });

    const invalidAppointment = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if (invalidAppointment)
      return res.status(401).json({
        error: 'The provider already has an appointment on this date!',
      });

    if (provider_id === req.userId)
      return res.status(401).json({
        error: 'Provider and user have to be different!',
      });

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date,
    });

    const user = await User.findByPk(req.userId);
    const formattedDate = format(hourStart, "'dia 'dd' de 'MMMM' às 'H:mm'h'", {
      locale: pt,
    });

    await Notification.create({
      content: `Agendamento realizado para ${user.name} para ${formattedDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        { model: User, as: 'provider', attributes: ['name', 'email'] },
        { model: User, as: 'user', attributes: ['name'] },
      ],
    });

    if (appointment.user_id !== req.userId)
      return res
        .status(401)
        .json('This user is not allowed to cancel this appointment!');

    const allowedDate = subHours(appointment.date, 2);

    if (isBefore(allowedDate, new Date()))
      return res
        .status(401)
        .json('To cancel appointment you must be 2 hours in advance!');

    appointment.canceled_at = new Date();

    await appointment.save();

    await Queue.add(CancellationMail.key, { appointment });

    return res.json(appointment);
  }
}

export default new AppointmentController();
