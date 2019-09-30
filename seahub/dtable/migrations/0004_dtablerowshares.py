# -*- coding: utf-8 -*-
# Generated by Django 1.11.23 on 2019-09-17 10:47
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('dtable', '0003_auto'),
    ]

    operations = [
        migrations.CreateModel(
            name='DTableRowShares',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('username', models.CharField(db_index=True, max_length=255)),
                ('workspace_id', models.IntegerField(db_index=True)),
                ('dtable_uuid', models.CharField(db_index=True, max_length=36)),
                ('table_id', models.CharField(max_length=36)),
                ('row_id', models.CharField(db_index=True, max_length=36)),
                ('token', models.CharField(max_length=100, unique=True)),
            ],
            options={
                'db_table': 'dtable_row_shares',
            },
        ),
    ]