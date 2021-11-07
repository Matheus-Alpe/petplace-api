import JWT from 'jsonwebtoken';
import { authenticateUser, getUserByProperty, showAllVetHistoryFromUserPets, showUserPets, showAllTermsFromUser } from '../db.js';

const SECRET = 'TEST';

export default {
    async authenticate(req, res) {
        const { email, password } = req.body;

        let result = await authenticateUser(email, password);

        if (!result)
            return res
                .status(403)
                .send({ message: 'E-mail ou Senha incorreto.' });

        const user = { ...result };

        const token = JWT.sign(user, SECRET, {
            expiresIn: 7200,
        });

        res.status(200).send({
            message: 'Login efetuado com sucesso',
            token,
            user,
        });

        return;
    },

    validateSession(req, res, next) {
        const token = req.headers.authorization
            ? req.headers.authorization.split(' ')[1]
            : null;

        if (!token) {
            res.status(401).send({
                message: 'Sua sessão é inválida.',
            });
            return;
        }

        JWT.verify(token, SECRET, (err, decoded) => {
            if (err) {
                res.status(401).send({
                    message: 'Sua sessão está expirada.'
                });
            }

            req.data = decoded;

            next();
        });
    },

    loadSession(req, res) {
        const token = req.headers.authorization.split(' ')[1];

        JWT.verify(token, SECRET, async (err, decoded) => {
            try {
                if (err) {
                    return res.status(401).send({
                        message: 'Sua sessão é inválida ou está expirada',
                    });
                }
    
                const tempUser = await getUserByProperty(decoded.id, 'id');
                if (!tempUser) {
                    return res.status(401).send({
                        message: 'Sua sessão é inválida ou está expirada',
                    });
                }

                const pets = await showUserPets(tempUser) || [];
                const vetHistory = await showAllVetHistoryFromUserPets(decoded) || [];
                let resultTerms = await showAllTermsFromUser(tempUser) || [];
                let termResponsibility = []

                if (resultTerms.length) {
                    termResponsibility = await Promise.all(resultTerms.map(async (term) => {
                        let tempTerm = { ...term }
                        
                        if (tempUser.cpf) {
                            tempTerm.info = await getUserByProperty(term['donator_identifier'], 'cnpj');
                        }

                        if (tempUser.cnpj) {
                            tempTerm.info = await getUserByProperty(term['adopter_identifier'], 'cpf');
                        }

                        if (tempTerm.info && tempTerm.info.password) {
                            delete tempTerm.info.password;
                        }

                        return tempTerm;
                    }));
                }
                
                res.status(200).send({
                    token,
                    user: { ...tempUser },
                    pets,
                    vetHistory,
                    terms: termResponsibility
                });
            } catch (error) {
                res.status(401).send({
                    message: 'Sua sessão é inválida ou está expirada',
                });
            }
        });
    },
};
