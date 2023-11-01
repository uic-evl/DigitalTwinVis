import torch 
import torch.nn as nn
import numpy as np


def lognormal_loss(shape,scale,t,e,k):

    k_ = shape.expand(t.shape[0], -1)
    b_ = scale.expand(t.shape[0], -1)
    ll = 0.
    risk=1
    for g in range(k):

        mu = k_[:, g]
        sigma = b_[:, g]

        f = - sigma - 0.5*np.log(2*np.pi)
        f = f - torch.div((torch.log(t) - mu)**2, 2.*torch.exp(2*sigma))
        s = torch.div(torch.log(t) - mu, torch.exp(sigma)*np.sqrt(2))
        s = 0.5 - 0.5*torch.erf(s)
        s = torch.log(s)

        uncens = np.where(e.cpu().data.numpy() == int(risk))[0]
        cens = np.where(e.cpu().data.numpy() != int(risk))[0]
        ll += f[uncens].sum() + s[cens].sum()

    return -ll.mean()


def conditional_lognormal_loss(shape,scale,logits, t, e, k, discount=1.0,elbo=True):

    alpha = discount

    lossf = []
    losss = []

    k_ = shape
    b_ = scale
    risk=1
    for g in range(k):

        mu = k_[:, g]
        sigma = b_[:, g]

        f = - sigma - 0.5*np.log(2*np.pi)
        f = f - torch.div((torch.log(t) - mu)**2, 2.*torch.exp(2*sigma))
        s = torch.div(torch.log(t) - mu, torch.exp(sigma)*np.sqrt(2))
        s = 0.5 - 0.5*torch.erf(s)
        s = torch.log(s)

        lossf.append(f)
        losss.append(s)

    losss = torch.stack(losss, dim=1)
    lossf = torch.stack(lossf, dim=1)

    if elbo:

        lossg = nn.Softmax(dim=1)(logits)
        losss = lossg*losss
        lossf = lossg*lossf

        losss = losss.sum(dim=1)
        lossf = lossf.sum(dim=1)

    else:

        lossg = nn.LogSoftmax(dim=1)(logits)
        losss = lossg + losss
        lossf = lossg + lossf

        losss = torch.logsumexp(losss, dim=1)
        lossf = torch.logsumexp(lossf, dim=1)

    uncens = np.where(e.cpu().data.numpy() == int(risk))[0]
    cens = np.where(e.cpu().data.numpy() != int(risk))[0]
    ll = lossf[uncens].sum() + alpha*losss[cens].sum()

    return -ll/float(len(uncens)+len(cens))

# def conditional_weibull_loss(model, x, t, e, elbo=True, risk='1'):

#     alpha = model.discount
#     shape, scale, logits = model.forward(x)
# #     print('stuff',shape,scale,logits)
#     k_ = shape
#     b_ = scale

#     lossf = []
#     losss = []

#     for g in range(model.k):

#         k = k_[:, g]
#         b = b_[:, g]
#         #So this explodes which is why I'm not using weibull loss anymore
#         s = - (torch.pow(torch.exp(b)*t, torch.exp(k)))
#         f = k + b + ((torch.exp(k)-1)*(b+torch.log(t)))
#         f = f + s

#         lossf.append(f)
#         losss.append(s)

#     losss = torch.stack(losss, dim=1)
#     lossf = torch.stack(lossf, dim=1)
#     if elbo:

#         lossg = nn.Softmax(dim=1)(logits)
#         losss = lossg*losss
#         lossf = lossg*lossf
#         losss = losss.sum(dim=1)
#         lossf = lossf.sum(dim=1)

#     else:

#         lossg = nn.LogSoftmax(dim=1)(logits)
#         losss = lossg + losss
#         lossf = lossg + lossf
#         losss = torch.logsumexp(losss, dim=1)
#         lossf = torch.logsumexp(lossf, dim=1)

#     uncens = np.where(e.cpu().data.numpy() == int(risk))[0]
#     cens = np.where(e.cpu().data.numpy() != int(risk))[0]
#     ll = lossf[uncens].sum() + alpha*losss[cens].sum()

#     return -ll/float(len(uncens)+len(cens))
# def weibull_loss(model, t, e, risk='1'):
#     shape, scale = model.get_shape_scale()

#     k_ = shape.expand(t.shape[0], -1)
#     b_ = scale.expand(t.shape[0], -1)

#     ll = 0.
#     for g in range(model.k):

#         k = k_[:, g]
#         b = b_[:, g]

#         s = - (torch.pow(torch.exp(b)*t, torch.exp(k)))
#         f = k + b + ((torch.exp(k)-1)*(b+torch.log(t)))
#         f = f + s

#         uncens = np.where(e.cpu().data.numpy() == int(risk))[0]
#         cens = np.where(e.cpu().data.numpy() != int(risk))[0]
#         ll += f[uncens].sum() + s[cens].sum()

#     return -ll.mean()