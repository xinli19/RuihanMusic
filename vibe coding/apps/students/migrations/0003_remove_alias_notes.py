from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('students', '0002_backfill_notes'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='student',
            name='research_notes',
        ),
        migrations.RemoveField(
            model_name='student',
            name='operation_notes',
        ),
    ]