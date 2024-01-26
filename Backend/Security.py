from typing import Tuple
import os
import hashlib
import hmac
import base64
import pickle

def hash_new_password(password: str) -> Tuple[bytes, bytes]:
    """
    Hash the provided password with a randomly-generated salt and return the
    salt and hash to store in the database.
    """
    salt = os.urandom(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return salt, pw_hash

def is_correct_password(salt: bytes, pw_hash: bytes, password: str) -> bool:
    """
    Given a previously-stored salt and hash, and a password provided by a user
    trying to log in, check whether the password is correct.
    """
    return hmac.compare_digest(
        pw_hash,
        hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    )

def save_account(username, password,current_passwords  = None,current_password_file = '../data/homework.pk',overwrite=False):
    flag = True
    if current_passwords is None:
        try:
            with open(current_password_file,'rb') as f:
                current_passwords = pickle.load(f)
        except Exception as e:
            print('error loading passwords',current_password_file)
            print(e)
            print('making new file')
            current_passwords= {}
    if current_passwords.get(username) is not None and (not overwrite):
        print('username',username,'already exists')
        return False
    (nsalt, npass) = hash_new_password(password)
    entry = {'salt': nsalt, 'pwd': npass}
    current_passwords[username] = entry
    try:
        with open(current_password_file,'wb') as f:
            pickle.dump(current_passwords,f)
        return True
    except Exception as e:
        print('error loading passwords',current_password_file)
        print(e)
        return False
    return False

def check_password(username, password, current_passwords = None, pfile='../data/homework.pk'):
    if current_passwords is None:
        try:
            with open(pfile,'rb') as f:
                current_passwords = pickle.load(f)
        except Exception as e:
            print('error loading passwords in check_passwords',pfile)
            print(e)
            return False
    account = current_passwords.get(username,None)
    if account is None:
        return False
    salt  = account['salt']
    pwd_hash = account['pwd']
    return is_correct_password(salt,pwd_hash,password)